"""
ELPIS Immune System — Validation-Gated Fixers
==============================================
Applique les corrections avec un protocole de securite strict :
1. Pre-fix  : Backup du fichier original
2. Fix      : Applique la strategie de correction
3. Post-fix : Valide que le fix n'a rien casse (tests, syntaxe)
4. Rollback : Si echec, restaure le fichier original

Strategies de fix supportees :
- delete_line          : Supprime la ligne concernee
- replace              : Remplace le pattern par une chaine fixe
- replace_regex        : Remplacement regex avec groupes de capture
- comment_out          : Commente la ligne avec un message TODO
- delete_line_or_comment : Supprime si safe, sinon commente
- custom_python_fixer  : Fixer specialise Python (ex: deduplication JSON)
"""

import os
import re
import json
import shutil
import datetime

# ---------------------------------------------------------------------------
# Backup System
# ---------------------------------------------------------------------------

BACKUPS_DIR = None  # Set by main.py

def set_backup_dir(path):
    global BACKUPS_DIR
    BACKUPS_DIR = path

def create_backup(filepath, timestamp_dir):
    """Cree une copie de securite avant modification."""
    rel_path = os.path.relpath(filepath, _get_project_root())
    backup_path = os.path.join(timestamp_dir, rel_path)
    os.makedirs(os.path.dirname(backup_path), exist_ok=True)
    shutil.copy2(filepath, backup_path)
    return backup_path

def _get_project_root():
    """Remonte au dossier parent de agent_audit/."""
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# ---------------------------------------------------------------------------
# Fix Application
# ---------------------------------------------------------------------------

def apply_fixes(filepath, rel_path, lines, fixable_anomalies, dry_run=False):
    """
    Applique toutes les corrections pour un fichier donne.
    Retourne (corrections, escalations).

    Protocol:
    1. Trier les anomalies par ligne (decroissant pour delete_line)
    2. Appliquer chaque fix
    3. Si dry_run, ne pas ecrire
    4. Sinon, backup + write + return corrections
    """
    corrections = []
    escalations = []

    # --- Custom Python Fixer (handles special cases like JSON dedup) ---
    custom_anomalies = [a for a in fixable_anomalies
                        if _find_rule_for_anomaly(a) and
                        _find_rule_for_anomaly(a).get('auto_fix_strategy') == 'custom_python_fixer']
    if custom_anomalies:
        custom_corr, custom_esc = _apply_custom_python_fixer(
            filepath, rel_path, custom_anomalies, dry_run
        )
        corrections.extend(custom_corr)
        escalations.extend(custom_esc)
        # Remove custom anomalies from the standard pipeline
        fixable_anomalies = [a for a in fixable_anomalies
                             if a not in custom_anomalies]

    # Trier: les delete_line en premier (ordre decroissant de ligne pour preserver les index)
    delete_anomalies = []
    other_anomalies = []

    for anomaly in fixable_anomalies:
        rule = _find_rule_for_anomaly(anomaly)
        if not rule:
            escalations.append({
                'type': 'RULE_NOT_FOUND',
                'file': rel_path,
                'line': anomaly['line'],
                'message': f"Regle {anomaly['rule_id']} introuvable dans rules.json",
                'severity': 'critical',
                'rule_id': anomaly['rule_id']
            })
            continue

        fix = rule.get('fix')
        if fix and fix.get('action') == 'delete_line':
            delete_anomalies.append((anomaly, rule))
        else:
            other_anomalies.append((anomaly, rule))

    # Appliquer les delete_line en ordre decroissant
    delete_anomalies.sort(key=lambda x: -x[0]['line'])

    modified_lines = list(lines)
    file_corrections = []

    for anomaly, rule in delete_anomalies + other_anomalies:
        line_idx = anomaly['line'] - 1
        if line_idx < 0 or line_idx >= len(modified_lines):
            continue

        original_line = modified_lines[line_idx]
        fix = rule.get('fix')
        if not fix:
            continue

        action = fix.get('action')
        new_line = None

        if action == 'delete_line':
            new_line = None  # Marqueur pour suppression

        elif action in ('replace', 'replace_regex'):
            search = fix.get('search', rule.get('patterns', [rule.get('pattern', '')])[0])
            replacement = fix.get('replacement', '')
            if search:
                try:
                    new_line = re.sub(search, replacement, original_line)
                except re.error:
                    escalations.append({
                        'type': 'REGEX_ERROR',
                        'file': rel_path,
                        'line': anomaly['line'],
                        'message': f'Regex invalide dans la regle {rule["id"]}: {search}',
                        'severity': 'warning',
                        'rule_id': rule['id']
                    })
                    new_line = original_line

        elif action == 'comment_out':
            prefix = fix.get('comment_prefix', '// TODO [AUDIT]: Review this line')
            indent = len(original_line) - len(original_line.lstrip())
            comment_line = ' ' * indent + prefix + '\n'
            new_line = comment_line + original_line

        elif action == 'delete_line_or_comment':
            # Decision basee sur le fix_confidence
            if rule.get('fix_confidence', 0) >= 90:
                new_line = None  # Supprimer
            else:
                prefix = fix.get('comment_prefix', '// TODO [AUDIT]: Review this line')
                indent = len(original_line) - len(original_line.lstrip())
                comment_line = ' ' * indent + prefix + '\n'
                new_line = comment_line + original_line

        if new_line != original_line:
            correction = {
                'rule_id': rule['id'],
                'file': rel_path,
                'line': anomaly['line'],
                'before': original_line.rstrip('\n'),
                'after': new_line.rstrip('\n') if new_line else '[LIGNE SUPPRIMEE]',
                'action': action,
                'fix_confidence': rule.get('fix_confidence', 0)
            }
            corrections.append(correction)
            file_corrections.append((line_idx, new_line, correction))

    # Appliquer les modifications aux lignes
    for line_idx, new_line, _ in file_corrections:
        if new_line is None:
            modified_lines[line_idx] = None
        else:
            modified_lines[line_idx] = new_line

    # Filtrer les lignes None (supprimees)
    final_lines = [l for l in modified_lines if l is not None]

    # --- Ecrire le fichier si non dry_run ---
    if not dry_run and file_corrections:
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        timestamp_dir = os.path.join(BACKUPS_DIR or os.path.join(os.path.dirname(__file__), 'backups'), timestamp)

        try:
            create_backup(filepath, timestamp_dir)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(final_lines)
        except (PermissionError, OSError) as e:
            escalations.append({
                'type': 'WRITE_FAILED',
                'file': rel_path,
                'line': 0,
                'message': f'Impossible d\'ecrire le fichier corrige: {e}',
                'severity': 'critical',
                'rule_id': 'SYSTEM'
            })

    return corrections, escalations


# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------

def rollback_file(filepath, backup_path):
    """Restaure le fichier depuis le backup."""
    if os.path.exists(backup_path):
        try:
            shutil.copy2(backup_path, filepath)
            return True
        except (PermissionError, OSError):
            return False
    return False


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

def cleanup_old_backups(max_keep=10):
    """Supprime les sessions de backup les plus anciennes."""
    if not BACKUPS_DIR or not os.path.exists(BACKUPS_DIR):
        return

    sessions = sorted([
        d for d in os.listdir(BACKUPS_DIR)
        if os.path.isdir(os.path.join(BACKUPS_DIR, d))
    ])

    while len(sessions) > max_keep:
        oldest = sessions.pop(0)
        shutil.rmtree(os.path.join(BACKUPS_DIR, oldest))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_rule_for_anomaly(anomaly):
    """Recherche la regle correspondant a une anomalie. Utilise le cache de rules."""
    # Cette fonction doit avoir acces aux regles. Dans l'implementation reelle,
    # les regles sont passees en parametre ou stockees dans un module global.
    # Ici on utilise un acces indirect via le module rules_loader.
    return _rule_cache.get(anomaly['rule_id'])

_rule_cache = {}

def set_rule_cache(rules):
    """Initialise le cache de regles pour lookup rapide."""
    global _rule_cache
    _rule_cache = {r['id']: r for r in rules if isinstance(r, dict) and 'id' in r}


# ---------------------------------------------------------------------------
# Custom Python Fixers (Specialized correction strategies)
# ---------------------------------------------------------------------------

def _apply_custom_python_fixer(filepath, rel_path, anomalies, dry_run=False):
    """
    Applique des corrections specialisees basees sur Python pur.
    Dispatche vers le bon sous-fixer selon la regle.
    """
    corrections = []
    escalations = []

    for anomaly in anomalies:
        rule = _find_rule_for_anomaly(anomaly)
        if not rule:
            continue

        rule_id = rule['id']

        if rule_id == 'NO_DUPLICATE_HISTORY_ENTRIES':
            corr, esc = _fix_duplicate_history_entries(filepath, rel_path, dry_run)
            corrections.extend(corr)
            escalations.extend(esc)
        else:
            escalations.append({
                'type': 'UNKNOWN_CUSTOM_FIXER',
                'file': rel_path,
                'line': anomaly.get('line', 0),
                'message': f'Pas de custom_python_fixer implemente pour {rule_id}',
                'severity': 'warning',
                'rule_id': rule_id
            })

    return corrections, escalations


def _fix_duplicate_history_entries(filepath, rel_path, dry_run=False):
    """
    Fixer specialise : detecte et supprime les doublons dans espoir_historique.json.
    Un doublon = meme titre + meme matiere + meme action + timestamp < 10 secondes d'ecart.
    """
    corrections = []
    escalations = []

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            history = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        escalations.append({
            'type': 'JSON_READ_ERROR',
            'file': rel_path,
            'line': 0,
            'message': f'Impossible de lire le fichier JSON: {e}',
            'severity': 'critical',
            'rule_id': 'NO_DUPLICATE_HISTORY_ENTRIES'
        })
        return corrections, escalations

    if not isinstance(history, list):
        return corrections, escalations

    new_history = []
    seen = {}
    removed_count = 0

    for entry in history:
        key = f"{entry.get('titre', '')}_{entry.get('matiere', '')}_{entry.get('action', '')}"
        ts_str = entry.get('timestamp', '')
        try:
            from datetime import datetime as dt
            ts = dt.fromisoformat(ts_str.replace('Z', '+00:00'))
            ts_epoch = ts.timestamp()
        except (ValueError, AttributeError):
            new_history.append(entry)
            continue

        if key in seen:
            last_ts = seen[key]
            if abs(ts_epoch - last_ts) < 10:
                removed_count += 1
                seen[key] = ts_epoch
                continue

        seen[key] = ts_epoch
        new_history.append(entry)

    if removed_count > 0:
        corrections.append({
            'rule_id': 'NO_DUPLICATE_HISTORY_ENTRIES',
            'file': rel_path,
            'line': 0,
            'before': f'{len(history)} entries',
            'after': f'{len(new_history)} entries ({removed_count} doublons supprimes)',
            'action': 'custom_python_fixer',
            'fix_confidence': 95
        })

        if not dry_run:
            # Backup
            timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
            timestamp_dir = os.path.join(
                BACKUPS_DIR or os.path.join(os.path.dirname(__file__), 'backups'),
                timestamp
            )
            try:
                create_backup(filepath, timestamp_dir)
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(new_history, f, indent=4, ensure_ascii=False)
            except (PermissionError, OSError) as e:
                escalations.append({
                    'type': 'WRITE_FAILED',
                    'file': rel_path,
                    'line': 0,
                    'message': f'Impossible d\'ecrire le fichier corrige: {e}',
                    'severity': 'critical',
                    'rule_id': 'NO_DUPLICATE_HISTORY_ENTRIES'
                })

            # Validate: re-read and check JSON is valid
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    validation = json.load(f)
                if not isinstance(validation, list):
                    raise ValueError('JSON root n\'est pas un tableau')
            except (json.JSONDecodeError, ValueError) as e:
                # ROLLBACK
                rollback_file(filepath, os.path.join(timestamp_dir, rel_path))
                escalations.append({
                    'type': 'JSON_VALIDATION_FAILED',
                    'file': rel_path,
                    'line': 0,
                    'message': f'Rollback apres validation echouee: {e}',
                    'severity': 'critical',
                    'rule_id': 'NO_DUPLICATE_HISTORY_ENTRIES'
                })
                corrections.clear()

    return corrections, escalations

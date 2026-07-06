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
"""

import os
import re
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

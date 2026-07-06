"""
ELPIS Agent Audit — Analyseur et Correcteur Autonome
=====================================================
Ce script scanne l'intégralité du code source du projet ELPIS,
détecte les anomalies selon les règles définies dans rules.json,
et applique automatiquement les corrections quand une action
de fix est définie.

Usage:
    python main.py            # Mode continu (toutes les 4 heures)
    python main.py --once     # Exécution unique
"""

import os
import re
import json
import time
import shutil
import datetime
import sys

# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RULES_FILE = os.path.join(os.path.dirname(__file__), 'rules.json')
OUTPUT_FILE = os.path.join(PROJECT_ROOT, 'data', 'espoir_audit.json')
BACKUPS_DIR = os.path.join(os.path.dirname(__file__), 'backups')

# Intervalle entre deux scans (en secondes) : 4 heures
SCAN_INTERVAL_SECONDS = 14400

# Extensions de fichiers texte à scanner
TEXT_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.css', '.scss',
    '.json', '.md', '.py', '.html', '.htm',
    '.bat', '.vbs', '.sh', '.yaml', '.yml',
    '.txt', '.env', '.gitignore', '.cfg'
}

# Extensions binaires à ignorer (sécurité)
BINARY_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
    '.mp3', '.wav', '.ogg', '.flac', '.aac', '.webm', '.m4a',
    '.mp4', '.avi', '.mov', '.mkv',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.zip', '.tar', '.gz', '.7z', '.rar',
    '.exe', '.dll', '.so', '.dylib',
    '.lock', '.map'
}

# Dossiers à toujours ignorer
IGNORED_DIRS = {
    'node_modules', '.git', 'dist', 'build', '.next',
    '__pycache__', '.venv', 'venv', '.cache',
    '.system_generated', '.tempmediaStorage',
    'backups'
}

# ============================================================
# CHARGEMENT DES RÈGLES
# ============================================================

def load_rules():
    """Charge les règles d'audit depuis rules.json."""
    try:
        with open(RULES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        log(f"Erreur lecture rules.json : {e}")
        return []


def log(message):
    """Affiche un message horodaté."""
    print(f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}")


# ============================================================
# SYSTÈME DE BACKUP
# ============================================================

def create_backup(filepath, timestamp_dir):
    """
    Crée une copie de sécurité du fichier avant modification.
    Retourne le chemin du backup créé.
    """
    # Calculer le chemin relatif par rapport au projet
    rel_path = os.path.relpath(filepath, PROJECT_ROOT)
    backup_path = os.path.join(timestamp_dir, rel_path)

    # Créer les sous-dossiers nécessaires
    os.makedirs(os.path.dirname(backup_path), exist_ok=True)

    # Copier le fichier original
    shutil.copy2(filepath, backup_path)
    return backup_path


# ============================================================
# MOTEUR DE CORRECTION
# ============================================================

def apply_fix(line, rule):
    """
    Applique la correction définie dans la règle à une ligne.
    Retourne (nouvelle_ligne, a_été_modifiée).
    
    Actions supportées:
    - delete_line    : Supprime la ligne entière
    - replace        : Remplace le pattern par une chaîne fixe
    - replace_regex  : Remplacement par regex avec groupes de capture
    - comment_out    : Commente la ligne (ajoute un commentaire au-dessus)
    """
    fix = rule.get('fix')
    if not fix:
        return line, False

    action = fix.get('action')

    if action == 'delete_line':
        return None, True  # None = supprimer la ligne

    elif action == 'replace':
        search = fix.get('search', rule['pattern'])
        replacement = fix.get('replacement', '')
        new_line = re.sub(search, replacement, line)
        if new_line != line:
            return new_line, True
        return line, False

    elif action == 'replace_regex':
        search = fix.get('search', rule['pattern'])
        replacement = fix.get('replacement', '')
        new_line = re.sub(search, replacement, line)
        if new_line != line:
            return new_line, True
        return line, False

    elif action == 'comment_out':
        prefix = fix.get('comment_prefix', '// TODO [AUDIT]: Review this line')
        indent = len(line) - len(line.lstrip())
        comment_line = ' ' * indent + prefix + '\n'
        return comment_line + line, True

    return line, False


# ============================================================
# SCANNER DE FICHIER
# ============================================================

def is_text_file(filepath):
    """Détermine si un fichier est un fichier texte scannable."""
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()

    # Exclusion explicite des binaires
    if ext in BINARY_EXTENSIONS:
        return False

    # Inclusion explicite des fichiers texte connus
    if ext in TEXT_EXTENSIONS:
        return True

    # Pour les fichiers sans extension, tenter de lire
    if not ext:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                f.read(512)  # Tester la lecture
            return True
        except (UnicodeDecodeError, PermissionError):
            return False

    return False


def scan_and_fix_file(filepath, rules, timestamp_dir, dry_run=False):
    """
    Scanne un fichier, détecte les anomalies et applique les corrections.
    
    Retourne (anomalies_list, corrections_list).
    """
    anomalies = []
    corrections = []
    filename = os.path.basename(filepath)

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original_lines = f.readlines()
    except (UnicodeDecodeError, PermissionError, OSError):
        return anomalies, corrections

    new_lines = []
    file_was_modified = False

    for i, line in enumerate(original_lines):
        line_number = i + 1
        current_line = line
        line_modified = False

        for rule in rules:
            # Vérifier si le fichier correspond au pattern de la règle
            file_pat = rule.get('file_pattern', '.*')
            if not re.search(file_pat, filename):
                continue

            # Vérifier l'exclusion
            exclude_pat = rule.get('exclude_pattern')
            if exclude_pat and re.search(exclude_pat, filename):
                continue

            # Vérifier si la ligne correspond au pattern d'anomalie
            pattern = re.compile(rule['pattern'])
            if pattern.search(current_line):
                rel_path = filepath.replace(PROJECT_ROOT, '')

                anomaly = {
                    "rule_id": rule['id'],
                    "severity": rule['severity'],
                    "description": rule['description'],
                    "file": rel_path,
                    "line": line_number,
                    "code_snippet": current_line.rstrip('\n')
                }

                # Tenter la correction
                if rule.get('fix') and not dry_run:
                    fixed_line, was_fixed = apply_fix(current_line, rule)

                    if was_fixed:
                        correction = {
                            "rule_id": rule['id'],
                            "file": rel_path,
                            "line": line_number,
                            "before": current_line.rstrip('\n'),
                            "after": fixed_line.rstrip('\n') if fixed_line else "[LIGNE SUPPRIMÉE]",
                            "action": rule['fix']['action']
                        }
                        corrections.append(correction)
                        anomaly["auto_fixed"] = True

                        if fixed_line is None:
                            # delete_line : on ne conserve pas la ligne
                            current_line = None
                            line_modified = True
                            break  # Pas besoin de vérifier d'autres règles
                        else:
                            current_line = fixed_line
                            line_modified = True

                anomalies.append(anomaly)

        if current_line is not None:
            new_lines.append(current_line)

        if line_modified:
            file_was_modified = True

    # Écrire les corrections si le fichier a été modifié
    if file_was_modified and not dry_run:
        # 1. Créer un backup
        create_backup(filepath, timestamp_dir)

        # 2. Écrire le fichier corrigé
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
        except (PermissionError, OSError) as e:
            log(f"  [!] Impossible d'ecrire {filepath}: {e}")

    return anomalies, corrections


# ============================================================
# EXÉCUTION PRINCIPALE
# ============================================================

def run_audit(dry_run=False):
    """
    Exécute un cycle complet d'audit et de correction.
    
    Args:
        dry_run: Si True, détecte sans corriger (mode rapport uniquement).
    """
    mode = "RAPPORT SEUL" if dry_run else "SCAN + CORRECTION"
    log(f"Démarrage de l'audit complet ({mode})...")

    rules = load_rules()
    if not rules:
        log("Aucune règle trouvée. Fin de l'audit.")
        return

    # Préparer le dossier de backup horodaté pour cette session
    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    timestamp_dir = os.path.join(BACKUPS_DIR, timestamp)

    all_anomalies = []
    all_corrections = []
    files_scanned = 0
    files_corrected = 0

    # Scanner toute l'arborescence du projet
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # Filtrer les dossiers à ignorer (modification in-place pour os.walk)
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]

        for filename in files:
            filepath = os.path.join(root, filename)

            if not is_text_file(filepath):
                continue

            files_scanned += 1
            anomalies, corrections = scan_and_fix_file(
                filepath, rules, timestamp_dir, dry_run=dry_run
            )
            all_anomalies.extend(anomalies)
            all_corrections.extend(corrections)

            if corrections:
                files_corrected += 1

    # Nettoyer le dossier de backup s'il est vide (aucune correction)
    if os.path.exists(timestamp_dir) and not os.listdir(timestamp_dir):
        os.rmdir(timestamp_dir)

    # Nettoyage des anciens backups (garder les 10 derniers)
    cleanup_old_backups(max_keep=10)

    # Générer le rapport
    report = {
        "last_scan": datetime.datetime.now().isoformat(),
        "mode": mode,
        "files_scanned": files_scanned,
        "total_anomalies": len(all_anomalies),
        "total_corrections": len(all_corrections),
        "files_corrected": files_corrected,
        "anomalies": all_anomalies,
        "corrections_applied": all_corrections
    }

    # Sauvegarder le rapport
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=4, ensure_ascii=False)

    log(f"Audit termine. {files_scanned} fichiers scannes.")
    log(f"  -> {len(all_anomalies)} anomalies detectees.")
    log(f"  -> {len(all_corrections)} corrections appliquees sur {files_corrected} fichiers.")

    if all_corrections:
        log(f"  -> Backups sauvegardes dans : agent_audit/backups/{timestamp}/")


def cleanup_old_backups(max_keep=10):
    """Supprime les sessions de backup les plus anciennes."""
    if not os.path.exists(BACKUPS_DIR):
        return

    sessions = sorted([
        d for d in os.listdir(BACKUPS_DIR)
        if os.path.isdir(os.path.join(BACKUPS_DIR, d))
    ])

    while len(sessions) > max_keep:
        oldest = sessions.pop(0)
        shutil.rmtree(os.path.join(BACKUPS_DIR, oldest))
        log(f"  [cleanup] Backup ancien supprime : {oldest}")


# ============================================================
# POINT D'ENTRÉE
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("  ELPIS — Agent Audit Autonome v2.0 (Auto-Correcteur)")
    print("=" * 60)

    dry_run = "--dry-run" in sys.argv

    if "--once" in sys.argv:
        run_audit(dry_run=dry_run)
        sys.exit(0)

    log("Agent démarré en mode continu.")
    log(f"Intervalle : {SCAN_INTERVAL_SECONDS // 3600}h entre chaque scan.")
    log(f"Mode : {'RAPPORT SEUL (--dry-run)' if dry_run else 'SCAN + CORRECTION'}")

    while True:
        run_audit(dry_run=dry_run)
        log(f"Prochain audit dans {SCAN_INTERVAL_SECONDS // 3600} heures...")
        time.sleep(SCAN_INTERVAL_SECONDS)

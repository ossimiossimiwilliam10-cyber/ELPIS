"""
ELPIS Immune System v3.0 — Agent Audit Autonome
===============================================
Systeme immunitaire du projet ELPIS. Scanne, detecte, corrige, valide, escalade.
Fonctionne en mode continu (daemon) ou one-shot.

Usage:
    python main.py                    # Mode continu (toutes les heures)
    python main.py --once             # Audit unique + correction
    python main.py --once --dry-run   # Audit unique, rapport seul
    python main.py --health           # Auto-diagnostic de l'agent
    python main.py --emergency-check  # Verifie uniquement les regles d'urgence
"""

import os
from linters import get_all_linter_anomalies
from collections import defaultdict
import datetime
import sys
import json
import time
import logging
import subprocess
from logging.handlers import RotatingFileHandler

# ---------------------------------------------------------------------------
# Imports internes
# ---------------------------------------------------------------------------
from engine import (load_rules, should_auto_fix, calculate_health_score,
                     _is_text_file)
from scanners import (run_all_scanners, run_global_scanners, extract_imports)
from fixers import (apply_fixes, set_backup_dir, set_rule_cache,
                    cleanup_old_backups)
from validators import (validate_after_fix, run_pre_fix_baseline)
from escalation import (create_escalation, process_escalations,
                        set_escalation_log, set_emergency_alert_file)
from health import run_health_check

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RULES_FILE = os.path.join(os.path.dirname(__file__), 'rules.json')
OUTPUT_FILE = os.path.join(PROJECT_ROOT, 'data', 'espoir_audit.json')
HEALTH_FILE = os.path.join(PROJECT_ROOT, 'data', 'espoir_audit_health.json')
BACKUPS_DIR = os.path.join(os.path.dirname(__file__), 'backups')
LOG_FILE = os.path.join(os.path.dirname(__file__), 'audit.log')
HASH_CACHE_FILE = os.path.join(PROJECT_ROOT, 'data', '.audit_hashes.json')
ESCALATION_LOG = os.path.join(os.path.dirname(__file__), 'escalations.log')
EMERGENCY_ALERTS = os.path.join(PROJECT_ROOT, 'data', 'espoir_emergency_alerts.json')

SCAN_INTERVAL_SECONDS = 3600  # 1 heure
MAX_PASSES = 3
MAX_BACKUPS = 10

# ---------------------------------------------------------------------------
# LOGGING
# ---------------------------------------------------------------------------

def setup_logger():
    logger = logging.getLogger("ElpisImmuneSystem")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        formatter = logging.Formatter('[%(asctime)s] [%(levelname)s] %(message)s',
                                      datefmt='%Y-%m-%d %H:%M:%S')

        console = logging.StreamHandler()
        console.setFormatter(formatter)
        logger.addHandler(console)

        file_handler = RotatingFileHandler(
            LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding='utf-8'
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger

log = setup_logger()

# ---------------------------------------------------------------------------
# BANNER
# ---------------------------------------------------------------------------

BANNER = """
+==========================================================+
|  ELPIS IMMUNE SYSTEM v3.0 — NASA-Grade Audit Agent      |
|  "Le systeme immunitaire ne negocie pas. Il corrige."    |
+==========================================================+
"""

# ---------------------------------------------------------------------------
# SCAN PIPELINE (appelee par chaque passe)
# ---------------------------------------------------------------------------

def scan_single_file(filepath, rel_path, lines, rules, all_files_data, source_files):
    """Scanne un fichier avec toutes les strategies et retourne les anomalies."""
    return run_all_scanners(filepath, rel_path, lines, rules,
                            all_files_data, source_files, PROJECT_ROOT)

# ---------------------------------------------------------------------------
# FIX PIPELINE
# ---------------------------------------------------------------------------

def fix_single_file(filepath, rel_path, lines, fixable_anomalies, dry_run=False):
    """Applique les corrections a un fichier et valide."""
    corrections, escalations, backup_path = apply_fixes(filepath, rel_path, lines, fixable_anomalies, dry_run)
    return corrections, escalations, backup_path

# ---------------------------------------------------------------------------
# REPORT GENERATION
# ---------------------------------------------------------------------------

def generate_output(report, health_report, output_path, health_path, rules=None):
    """Ecrit les rapports JSON."""
    # Rapport principal
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Ajouter le health score (pondere par false_positive_risk si rules dispo)
    report['health_score'] = calculate_health_score(report, rules)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # Rapport de sante de l'agent
    if health_report:
        os.makedirs(os.path.dirname(health_path), exist_ok=True)
        with open(health_path, 'w', encoding='utf-8') as f:
            json.dump(health_report, f, indent=2, ensure_ascii=False)

# ---------------------------------------------------------------------------
# REPORTER FUNCTION (conforme a l'interface engine)
# ---------------------------------------------------------------------------

def reporter_fn(report, rules=None):
    """Callback appele par l'engine apres chaque rapport genere."""
    score = calculate_health_score(report, rules)
    crit = report['anomalies_by_severity']['critical']
    warn = report['anomalies_by_severity']['warning']
    info = report['anomalies_by_severity']['info']

    log.info(f"  Health Score: {score}/100")
    log.info(f"  Anomalies Critiques: {crit}")
    log.info(f"  Avertissements (Warning): {warn}")
    log.info(f"  Suggestions & Code Smells (Info): {info}")
    log.info(f"  Total defauts detectes: {report['total_anomalies']}")
    log.info(f"  Corrections appliquees: {report['total_corrections']}")
    log.info(f"  Escalades (verifications manuelles requises): {report['total_escalations']}")

# ---------------------------------------------------------------------------
# AUTO COMMIT & PUSH
# ---------------------------------------------------------------------------

def auto_commit_and_push(files_corrected):
    """
    S'il y a eu des corrections, on commite et on pousse uniquement ces fichiers.
    """
    if not files_corrected:
        return

    try:
        log.info(f"Auto-commit de {len(files_corrected)} fichier(s) corrige(s)...")
        # On se place a la racine du projet
        # git add
        for f in files_corrected:
            subprocess.run(['git', 'add', f], cwd=PROJECT_ROOT, check=True)

        # git commit
        commit_msg = "🤖 fix(immune-system): auto-correction locale [skip ci]"
        subprocess.run(['git', 'commit', '-m', commit_msg], cwd=PROJECT_ROOT, check=True)

        # git push
        subprocess.run(['git', 'push'], cwd=PROJECT_ROOT, check=True)
        log.info("Auto-commit et push reussis.")
    except Exception as e:
        log.error(f"Erreur lors de l'auto-commit/push: {e}")

# ---------------------------------------------------------------------------
# MAIN AUDIT EXECUTION
# ---------------------------------------------------------------------------

def run_full_audit(dry_run=False, emergency_only=False):
    """
    Execute un cycle d'audit complet.

    Args:
        dry_run: Si True, detecte sans corriger.
        emergency_only: Si True, ne verifie que les regles critique/urgence.
    """
    start_time = time.time()
    log.info(f"{'='*60}")
    log.info(f"Demarrage de l'audit | Mode: {'RAPPORT SEUL' if dry_run else 'SCAN + CORRECTION'}"
             f"{' | URGENCE UNIQUEMENT' if emergency_only else ''}")
    log.info(f"{'='*60}")

    # --- 1. Charger les regles ---
    rules, meta = load_rules(RULES_FILE)
    if not rules:
        log.error("Aucune regle chargee. Arret.")
        return None

    log.info(f"Regles chargees: {len(rules)} (version {meta.get('version', 'inconnue')})")

    # Initialiser le cache de regles pour les fixers
    set_rule_cache(rules)

    # Filtrer si emergency only
    if emergency_only:
        rules = [r for r in rules if r.get('emergency_mode') or r.get('severity') == 'critical']
        log.info(f"Filtre urgence: {len(rules)} regles retenues")

    # --- 2. Setup des modules ---
    set_backup_dir(BACKUPS_DIR)
    set_escalation_log(ESCALATION_LOG)
    set_emergency_alert_file(EMERGENCY_ALERTS)

    # --- 3. Pre-fix baseline (optionnel) ---
    if not dry_run:
        log.info("Etablissement de la baseline de tests...")
        try:
            run_pre_fix_baseline()
        except Exception as e:
            log.warning(f"Impossible d'etablir la baseline: {e}")

    # --- 4. Phase 1 : Collecte des donnees (lecture de tous les fichiers) ---
    log.info("Phase 1: Collecte des fichiers et extraction des imports...")

    all_files_data = {}  # { rel_path: [imports] }
    source_files = []    # Liste des chemins relatifs
    files_content = {}   # { rel_path: lines }
    files_scanned = 0
    total_lines = 0

    for root, dirs, files in os.walk(PROJECT_ROOT):
        dirs[:] = [d for d in dirs if d not in {
            'node_modules', '.git', 'dist', 'build', '.next',
            '__pycache__', '.venv', 'venv', '.cache',
            '.system_generated', '.tempmediaStorage',
            'backups', 'documents', '.antigravity'
        }]

        for filename in files:
            filepath = os.path.join(root, filename)

            # Verifier si c'est un fichier texte
            if not _is_text_file(filepath):
                continue

            # Scan differentiel
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
            except (UnicodeDecodeError, PermissionError, OSError):
                continue

            rel_path = os.path.relpath(filepath, PROJECT_ROOT)
            source_files.append(rel_path)
            files_content[rel_path] = lines
            files_scanned += 1
            total_lines += len(lines)

            # Extraire les imports pour l'analyse globale
            imports = extract_imports(filepath, lines)
            if imports:
                all_files_data[rel_path] = imports

    log.info(f"Phase 1 terminee: {files_scanned} fichiers, {total_lines} lignes")

    # --- Variables de suivi global ---
    all_corrections = []
    all_escalations = []
    files_corrected = set()

    # --- 5. Phase 2 : Scanners globaux (import graph, layer, test coverage) ---
    log.info("Phase 2: Scanners globaux (graphe d'imports, frontieres, couverture de tests)...")
    global_anomalies = run_global_scanners(rules, all_files_data, source_files, PROJECT_ROOT)

    if global_anomalies:
        log.info(f"  -> {len(global_anomalies)} anomalies globales detectees")
        # Marquer les anomalies globales
        for anomaly in global_anomalies:
            rule = _find_rule(rules, anomaly['rule_id'])
            if rule:
                anomaly['_fixable'] = should_auto_fix(rule)
                anomaly['_escalation_message'] = rule.get('escalation_message', '')

        # Appliquer les corrections pour les anomalies globales (Tests, Sécurité)
        if not dry_run:
            from fixers import apply_fixes, rollback_file
            fixable_global = [a for a in global_anomalies if a.get('_fixable')]
            if fixable_global:
                log.info(f"  Tentative de correction de {len(fixable_global)} anomalies globales...")
                
                # Regrouper par fichier
                global_by_file = defaultdict(list)
                for a in fixable_global:
                    global_by_file[a['file']].append(a)
                    
                for fpath, file_anomalies in global_by_file.items():
                    rel_path = os.path.relpath(fpath, PROJECT_ROOT) if os.path.isabs(fpath) else fpath
                    abs_path = os.path.join(PROJECT_ROOT, rel_path) if not os.path.isabs(fpath) else fpath
                    
                    try:
                        with open(abs_path, 'r', encoding='utf-8') as f:
                            flines = f.readlines()
                    except Exception:
                        flines = []
                        
                    # Appliquer le fix via fixers.py
                    corrections, escalations, backup_path = apply_fixes(abs_path, rel_path, flines, file_anomalies, dry_run=False)
                    
                    if corrections:
                        # Sauvegarder le fichier
                        if backup_path and corrections[0].get('action') != 'npm_update':
                            # On revalide si ce n'est pas npm_update
                            validation_ok = validate_after_fix(abs_path, run_tests=True)
                            if not validation_ok:
                                log.warning(f"  [ROLLBACK] Validation échouée pour le fix global sur {rel_path}")
                                rollback_file(abs_path, backup_path)
                                continue
                                
                        all_corrections.extend(corrections)
                        files_corrected.add(rel_path)
                    
                    if escalations:
                        all_escalations.extend(escalations)

    # --- 6. Phase 3 : Scan fichier par fichier + corrections (ESLint, Ruff) ---
    log.info("Phase 3: Execution des linters standards (ESLint, Ruff)...")

    all_anomalies = list(global_anomalies)
    # Les corrections et escalades globales sont déjà dans les listes
    rule_hit_count = defaultdict(int)

    if not dry_run:
        linter_anomalies = get_all_linter_anomalies(PROJECT_ROOT, fix=False)
        fixable_by_file = defaultdict(list)
        for a in linter_anomalies:
            if a.get("_fixable"):
                fixable_by_file[a["file"]].append(a)

        for rel_path, anomalies in fixable_by_file.items():
            filepath = os.path.join(PROJECT_ROOT, rel_path)
            ext = os.path.splitext(filepath)[1].lower()
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            timestamp_dir = os.path.join(BACKUPS_DIR, timestamp)
            from fixers import create_backup
            try:
                backup_path = create_backup(filepath, timestamp_dir)
            except Exception:
                backup_path = None

            if ext in (".js", ".jsx", ".ts", ".tsx"):
                subprocess.run(["npx", "eslint", rel_path, "--fix"], cwd=PROJECT_ROOT, capture_output=True, shell=(os.name == 'nt'))
            elif ext == ".py":
                subprocess.run(["python", "-m", "ruff", "check", rel_path, "--fix"], cwd=PROJECT_ROOT, capture_output=True)

            validation_ok = validate_after_fix(filepath, run_tests=True)
            if not validation_ok:
                log.warning(f"  [ROLLBACK] Validation echouee pour {rel_path}")
                if backup_path:
                    rollback_file(filepath, backup_path)
            else:
                files_corrected.add(rel_path)
                for a in anomalies:
                    all_corrections.append({"rule_id": a["rule_id"], "file": rel_path, "line": a["line"], "before": "", "after": "Fixed by linter"})

    final_anomalies = get_all_linter_anomalies(PROJECT_ROOT, fix=False)
    for a in final_anomalies:
        rule_hit_count[a["rule_id"]] += 1
    all_anomalies.extend(final_anomalies)

    log.info(f"  Passe 1: {len(final_anomalies)} defauts trouves, {len(all_corrections)} corrections appliquees")
    # --- 7. Verifier les faux positifs potentiels ---
    for rule_id, count in rule_hit_count.items():
        if count >= 3:
            # La regle declenche beaucoup - potentiel faux positif
            rule = _find_rule(rules, rule_id)
            if rule and rule.get('false_positive_risk') in ('medium', 'high'):
                esc = create_escalation(
                    {'rule_id': rule_id, 'file': '', 'line': 0,
                     'code_snippet': f'{count} occurrences', 'description': rule['description']},
                    rule, 'PATTERN_TOO_BROAD',
                    {'occurrence_count': count}
                )
                all_escalations.append(esc)

    # --- 8. Construire le rapport ---
    report = _build_report(all_anomalies, all_corrections, all_escalations,
                           files_scanned, total_lines, files_corrected, dry_run)

    # --- 9. Health check de l'agent ---
    health_report = run_health_check(rules, report, all_escalations,
                                     all_corrections, RULES_FILE,
                                     OUTPUT_FILE, start_time)

    # --- 10. Sortie ---
    generate_output(report, health_report, OUTPUT_FILE, HEALTH_FILE, rules)
    reporter_fn(report, rules)

    # Afficher le health status
    overall = health_report.get('overall_status', 'UNKNOWN')
    log.info(f"Agent Health: {overall}")
    for w in health_report.get('warnings', []):
        log.warning(f"  [!] {w}")
    for r in health_report.get('recommendations', []):
        log.info(f"  [i] {r}")

    # Auto-commit des corrections
    if files_corrected and not dry_run:
        auto_commit_and_push(files_corrected)

    # Nettoyage
    cleanup_old_backups(MAX_BACKUPS)

    elapsed = time.time() - start_time
    log.info(f"Audit termine en {elapsed:.1f}s. Health Score projet: {report.get('health_score', 'N/A')}/100")

    return report

# ---------------------------------------------------------------------------
# HEALTH-ONLY MODE
# ---------------------------------------------------------------------------

def run_health_only():
    """Execute uniquement l'auto-diagnostic de l'agent."""
    print(BANNER)
    log.info("Mode: AUTO-DIAGNOSTIC")

    rules, meta = load_rules(RULES_FILE)
    if not rules:
        log.error("Impossible de charger les regles")
        return

    # Charger le dernier rapport s'il existe
    report = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                report = json.load(f)
        except (json.JSONDecodeError, OSError):
            report = {}

    health = run_health_check(rules, report, [], [], RULES_FILE, OUTPUT_FILE, time.time())

    print("\n+========================================+")
    print("|  AGENT SELF-DIAGNOSTIC                  |")
    print("+========================================+")
    print(f"|  Status: {health['overall_status']:<29}|")
    print(f"|  Regles: {health['rules_health']['total_rules']:<29}|")
    print(f"|  Regles actives: {health['rule_activity']['active_rules']:<23}|")
    print(f"|  Regles inactives: {health['rule_activity']['inactive_count']:<21}|")
    print(f"|  Escalades critiques: {health['escalation_health']['critical_escalations']:<19}|")
    print("+========================================+")

    if health['warnings']:
        print("\n[!] WARNINGS:")
        for w in health['warnings']:
            print(f"  - {w}")

    if health['recommendations']:
        print("\n[i] RECOMMENDATIONS:")
        for r in health['recommendations']:
            print(f"  - {r}")

    # Sauvegarder
    os.makedirs(os.path.dirname(HEALTH_FILE), exist_ok=True)
    with open(HEALTH_FILE, 'w', encoding='utf-8') as f:
        json.dump(health, f, indent=2, ensure_ascii=False)

    log.info(f"Rapport de sante sauvegarde: {HEALTH_FILE}")

# ---------------------------------------------------------------------------
# HELPERS (BINARY_EXTENSIONS, TEXT_EXTENSIONS, _is_text_file importes de engine.py)
# ---------------------------------------------------------------------------

# (Definitions supprimees - utilisees depuis engine.py)

def _build_report(anomalies, corrections, escalations,
                  files_scanned, total_lines, files_corrected, dry_run):
    """Construit le rapport d'audit structure avec statistiques par regle."""
    from collections import defaultdict

    # Anomalies par severite
    by_severity = {'critical': 0, 'warning': 0, 'info': 0}
    for a in anomalies:
        sev = a.get('severity', 'info')
        by_severity[sev] = by_severity.get(sev, 0) + 1

    # Anomalies par categorie
    by_category = defaultdict(int)
    for a in anomalies:
        cat = a.get('category', 'UNKNOWN')
        by_category[cat] += 1

    # --- NOUVEAU: Statistiques par regle (TOUTES les anomalies, pas tronquees) ---
    rule_stats = defaultdict(lambda: {
        'count': 0, 'severity': '', 'category': '', 'files': set(),
        'fixable_count': 0, 'auto_fixed_count': 0
    })
    for a in anomalies:
        rid = a.get('rule_id', 'UNKNOWN')
        rs = rule_stats[rid]
        rs['count'] += 1
        rs['severity'] = a.get('severity', '')
        rs['category'] = a.get('category', '')
        rs['files'].add(a.get('file', ''))
        if a.get('_fixable'):
            rs['fixable_count'] += 1

    for c in corrections:
        rid = c.get('rule_id', 'UNKNOWN')
        if rid in rule_stats:
            rule_stats[rid]['auto_fixed_count'] += 1

    # Convertir en format serialisable (set -> list, avec top files)
    rule_stats_serializable = {}
    for rid, rs in sorted(rule_stats.items(), key=lambda x: -x[1]['count']):
        rule_stats_serializable[rid] = {
            'count': rs['count'],
            'severity': rs['severity'],
            'category': rs['category'],
            'files_affected': len(rs['files']),
            'top_files': sorted(rs['files'])[:5],
            'fixable_count': rs['fixable_count'],
            'auto_fixed_count': rs['auto_fixed_count'],
            'pct_of_total': round(rs['count'] / max(len(anomalies), 1) * 100, 1)
        }

    # Stats d'escalade
    esc_stats = process_escalations(escalations, [])

    return {
        'last_scan': datetime.datetime.now().isoformat(),
        'mode': 'RAPPORT SEUL' if dry_run else 'SCAN + CORRECTION',
        'files_scanned': files_scanned,
        'total_lines_of_code': total_lines,
        'total_anomalies': len(anomalies),
        'total_corrections': len(corrections),
        'files_corrected': len(files_corrected),
        'total_escalations': len(escalations),
        'anomalies_by_severity': by_severity,
        'anomalies_by_category': dict(by_category),
        # NOUVEAU: stats par regle (full, non tronque)
        'rule_stats': rule_stats_serializable,
        # NOUVEAU: signal vs bruit (critiques + warnings hors high_fp_risk)
        'signal_count': sum(1 for a in anomalies
                          if a.get('severity') in ('critical', 'warning')
                          and a.get('_fp_risk', 'medium') != 'high'),
        'noise_count': sum(1 for a in anomalies
                         if a.get('severity') == 'info'
                         or a.get('_fp_risk') == 'high'),
        'escalation_stats': esc_stats,
        'escalations': escalations[:200],
        'anomalies': anomalies[:500],
        'corrections_applied': corrections[:500],
        '_anomalies_truncated': len(anomalies) > 500,
        '_escalations_truncated': len(escalations) > 200
    }

def _find_rule(rules, rule_id):
    for r in rules:
        if isinstance(r, dict) and r.get('id') == rule_id:
            return r
    return None

# ---------------------------------------------------------------------------
# POINT D'ENTREE
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print(BANNER)

    dry_run = "--dry-run" in sys.argv
    emergency_only = "--emergency-check" in sys.argv
    health_only = "--health" in sys.argv

    # Mode auto-diagnostic
    if health_only:
        run_health_only()
        sys.exit(0)

    # Mode one-shot
    if "--once" in sys.argv or emergency_only:
        run_full_audit(dry_run=dry_run, emergency_only=emergency_only)
        sys.exit(0)

    # Mode continu
    log.info(f"Agent demarre en mode continu. Intervalle: {SCAN_INTERVAL_SECONDS // 3600}h")
    log.info(f"Mode: {'RAPPORT SEUL' if dry_run else 'SCAN + CORRECTION'}")

    while True:
        try:
            run_full_audit(dry_run=dry_run)
        except Exception as e:
            log.error(f"Erreur pendant l'audit: {e}")
            import traceback
            log.error(traceback.format_exc())

        log.info(f"Prochain audit dans {SCAN_INTERVAL_SECONDS // 3600}h...")
        time.sleep(SCAN_INTERVAL_SECONDS)
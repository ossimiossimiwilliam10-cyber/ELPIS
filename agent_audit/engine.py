"""
ELPIS Immune System — Core Engine
=================================
Orchestrateur decisionnel : priorise les anomalies, calcule les scores de confiance,
decide quelles corrections appliquer, et pilote le multi-pass.
Ne modifie jamais un fichier sans passer par les validateurs.
"""

import os
import re
import json
import time
import hashlib
import datetime
from collections import defaultdict

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FIX_CONFIDENCE_THRESHOLD = 70       # En dessous, pas d'auto-fix
CRITICAL_IMMEDIATE_ACTION = True    # Les criticals declenchent une alerte immediate
MAX_RETRIES_PER_RULE = 3            # Si une regle produit 3+ faux positifs, elle est suspecte

# ---------------------------------------------------------------------------
# Rule Loading (compatible v2 et v3)
# ---------------------------------------------------------------------------

def load_rules(rules_path):
    """Charge les regles depuis rules.json. Compatible format v2 (array) et v3 (dict)."""
    with open(rules_path, 'r', encoding='utf-8') as f:
        raw = json.load(f)

    if isinstance(raw, list):
        # Format v2 : liste plate
        return raw, {}
    elif isinstance(raw, dict):
        # Format v3 : { meta: {...}, rules: [...] }
        rules = [r for r in raw.get('rules', []) if isinstance(r, dict)]
        return rules, raw.get('meta', {})
    else:
        raise ValueError(f"Format de regles inconnu: {type(raw)}")

# ---------------------------------------------------------------------------
# File Hashing (for change-only scanning)
# ---------------------------------------------------------------------------

def file_hash(filepath):
    """SHA256 rapide du contenu du fichier."""
    try:
        with open(filepath, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
    except (PermissionError, OSError):
        return None

def load_last_hashes(cache_path):
    """Charge le cache des hash de la session precedente."""
    if not os.path.exists(cache_path):
        return {}
    try:
        with open(cache_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}

def save_hashes(cache_path, hashes):
    """Sauvegarde le cache des hash pour la prochaine session."""
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(hashes, f, indent=2)

# ---------------------------------------------------------------------------
# Anomaly Priority Scoring
# ---------------------------------------------------------------------------

SEVERITY_WEIGHTS = {
    'critical': 100,
    'warning':  40,
    'info':     10
}

def severity_sort_key(anomaly):
    """Cle de tri : severite descendante, puis ID de regle."""
    return (-SEVERITY_WEIGHTS.get(anomaly.get('severity', 'info'), 0), anomaly.get('rule_id', ''))

def prioritize_anomalies(anomalies):
    """Trie les anomalies: criticals d'abord, puis warnings, puis infos."""
    return sorted(anomalies, key=severity_sort_key)

# ---------------------------------------------------------------------------
# Fix Decision Engine
# ---------------------------------------------------------------------------

def should_auto_fix(rule, anomaly_context=None):
    """
    Decide si l'agent doit corriger automatiquement cette anomalie.

    Criteres :
    1. La regle a une strategie de fix ET un fix_confidence >= THRESHOLD
    2. La regle n'est pas marquee requires_human
    3. On n'a pas deja tente de corriger cette meme anomalie 3+ fois
    """
    if rule.get('requires_human', False):
        return False

    fix_conf = rule.get('fix_confidence', 0)
    if fix_conf < FIX_CONFIDENCE_THRESHOLD:
        return False

    auto_strat = rule.get('auto_fix_strategy')
    if auto_strat == 'none' or auto_strat is None:
        return False

    return True

def is_emergency(rule):
    """Une regle en mode urgence necessite une alerte immediate."""
    return rule.get('emergency_mode', False) and rule.get('severity') == 'critical'

# ---------------------------------------------------------------------------
# Multi-pass Orchestrator
# ---------------------------------------------------------------------------

def run_multi_pass(scanner_fn, fixer_fn, validator_fn, reporter_fn,
                   project_root, rules, cache_path, max_passes=3, dry_run=False):
    """
    Orchestre l'audit multi-passe :
    1. Scan (avec cache pour ne scanner que les fichiers modifies)
    2. Priorise les anomalies
    3. Pour chaque anomalie corrigible, applique le fix via le validateur
    4. Re-scane (passe suivante) si des corrections ont ete faites
    5. Genere le rapport final
    """

    hash_cache = load_last_hashes(cache_path)
    new_hashes = {}
    all_anomalies = []
    all_corrections = []
    all_escalations = []
    files_corrected_set = set()
    files_scanned = 0
    total_lines = 0
    lines_by_ext = defaultdict(int)

    for pass_num in range(1, max_passes + 1):
        pass_anomalies = []
        pass_corrections = []

        for root, dirs, files in os.walk(project_root):
            # Ignorer les dossiers non pertinents
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

                # Scan differentiel : skip si le fichier n'a pas change
                if pass_num == 1:
                    fhash = file_hash(filepath)
                    if fhash is None:
                        continue
                    new_hashes[filepath] = fhash

                    if filepath in hash_cache and hash_cache[filepath] == fhash:
                        continue  # Fichier inchange, skip

                files_scanned += 1
                rel_path = os.path.relpath(filepath, project_root)

                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                except (UnicodeDecodeError, PermissionError, OSError):
                    continue

                total_lines += len(lines)
                _, ext = os.path.splitext(filename)
                ext = ext.lower() or 'no_extension'
                lines_by_ext[ext] += len(lines)

                # --- SCAN ---
                file_anomalies, file_lines = scanner_fn(filepath, rel_path, lines, rules)
                pass_anomalies.extend(file_anomalies)

                # --- FIX (si pas dry run) ---
                if not dry_run and file_anomalies:
                    fixable = [a for a in file_anomalies if a.get('_fixable')]
                    if fixable:
                        corrections, escalations = fixer_fn(filepath, rel_path, lines, fixable)
                        if corrections:
                            pass_corrections.extend(corrections)
                            files_corrected_set.add(rel_path)

                            # Validation post-fix
                            validation_ok = validator_fn(filepath)
                            if not validation_ok:
                                escalations.append({
                                    'type': 'FIX_BROKE_TESTS',
                                    'file': rel_path,
                                    'message': 'Les tests ont echoue APRES correction. ROLLBACK applique.',
                                    'severity': 'critical',
                                    'rule_id': corrections[-1].get('rule_id', 'UNKNOWN') if corrections else 'UNKNOWN'
                                })

                        if escalations:
                            all_escalations.extend(escalations)

        all_anomalies.extend(pass_anomalies)
        all_corrections.extend(pass_corrections)

        # Si pas de corrections cette passe, on arrete
        if not pass_corrections:
            break

    # Sauvegarder le cache des hash
    save_hashes(cache_path, new_hashes)

    # Construire le rapport
    report = _build_report(all_anomalies, all_corrections, all_escalations,
                           files_scanned, total_lines, lines_by_ext,
                           len(files_corrected_set), dry_run)

    # Generer la sortie via le reporter
    reporter_fn(report)

    return report

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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

TEXT_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.css', '.scss',
    '.json', '.md', '.py', '.html', '.htm',
    '.bat', '.vbs', '.sh', '.yaml', '.yml',
    '.txt', '.env', '.gitignore', '.cfg'
}

def _is_text_file(filepath):
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()
    if ext in BINARY_EXTENSIONS:
        return False
    if ext in TEXT_EXTENSIONS:
        return True
    if not ext:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                f.read(512)
            return True
        except (UnicodeDecodeError, PermissionError):
            return False
    return False

def _build_report(anomalies, corrections, escalations,
                  files_scanned, total_lines, lines_by_ext,
                  files_corrected, dry_run):
    """Construit le rapport d'audit structure."""
    return {
        'last_scan': datetime.datetime.now().isoformat(),
        'mode': 'RAPPORT SEUL' if dry_run else 'SCAN + CORRECTION',
        'files_scanned': files_scanned,
        'total_lines_of_code': total_lines,
        'lines_by_extension': dict(lines_by_ext),
        'total_anomalies': len(anomalies),
        'total_corrections': len(corrections),
        'files_corrected': files_corrected,
        'total_escalations': len(escalations),
        'anomalies_by_severity': {
            'critical': sum(1 for a in anomalies if a.get('severity') == 'critical'),
            'warning': sum(1 for a in anomalies if a.get('severity') == 'warning'),
            'info': sum(1 for a in anomalies if a.get('severity') == 'info'),
        },
        'anomalies_by_category': _count_by(anomalies, 'category'),
        'escalations': escalations,
        'anomalies': anomalies[:500],  # Tronquer pour eviter des fichiers JSON geants
        'corrections_applied': corrections[:500],
        '_anomalies_truncated': len(anomalies) > 500
    }

def _count_by(items, key):
    counts = defaultdict(int)
    for item in items:
        val = item.get(key, 'UNKNOWN')
        counts[val] += 1
    return dict(counts)

# ---------------------------------------------------------------------------
# Health Score Calculation
# ---------------------------------------------------------------------------

def calculate_health_score(report, rules=None):
    """
    Calcule un score de sante du projet (0-100) base sur le rapport d'audit.
    NASA-grade : pondere par le risque de faux positifs de chaque regle.
    
    - Les regles avec false_positive_risk='high' comptent pour 10% de leur poids normal
    - Les regles avec false_positive_risk='medium' comptent pour 40%
    - Les regles avec false_positive_risk='low' comptent a 100%
    - 0 anomaly critique (low fp risk) + 0 escalation = 100
    """
    score = 100

    # Construire le map de fp_risk par rule_id
    fp_risk_map = {}
    if rules:
        for r in rules:
            if isinstance(r, dict) and 'id' in r:
                fp_risk_map[r['id']] = r.get('false_positive_risk', 'medium')

    # Poids par niveau de risque de faux positif
    FP_WEIGHT = {'low': 1.0, 'medium': 0.4, 'high': 0.1}

    # Penalites ponderees par regle (via rule_stats si disponible)
    rule_stats = report.get('rule_stats', {})
    
    weighted_crit = 0
    weighted_warn = 0
    weighted_info = 0

    if rule_stats:
        for rid, rs in rule_stats.items():
            count = rs.get('count', 0)
            sev = rs.get('severity', 'info')
            fp_risk = fp_risk_map.get(rid, 'medium')
            weight = FP_WEIGHT.get(fp_risk, 0.4)
            # NASA-grade: log2 pour rendements decroissants
            # 1 hit = 1.0, 10 hits = 3.5, 100 hits = 6.6, 1000 hits = 10.0
            # Le score reste sensible aux ameliorations meme sur les high-volume rules
            import math
            log_count = math.log2(1 + count)
            weighted_count = log_count * weight

            if sev == 'critical':
                weighted_crit += weighted_count
            elif sev == 'warning':
                weighted_warn += weighted_count
            else:
                weighted_info += weighted_count
    else:
        # Fallback sans rule_stats
        crit_count = report.get('anomalies_by_severity', {}).get('critical', 0)
        warn_count = report.get('anomalies_by_severity', {}).get('warning', 0)
        info_count = report.get('anomalies_by_severity', {}).get('info', 0)
        weighted_crit = crit_count
        weighted_warn = warn_count
        weighted_info = info_count

    # Penalite totale ponderee
    total_penalty = (weighted_crit * 15 + weighted_warn * 3 + weighted_info * 0.5)

    # Bonus si des corrections ont ete appliquees
    if report.get('total_corrections', 0) > 0:
        total_penalty -= min(report['total_corrections'] * 2, 20)

    # Penalite d'escalade : ponderee par niveau
    esc_stats = report.get('escalation_stats', {})
    esc_by_level = esc_stats.get('by_level', {})
    total_penalty += esc_by_level.get('critical', 0) * 15
    total_penalty += esc_by_level.get('elevated', 0) * 8
    total_penalty += esc_by_level.get('standard', 0) * 3

    # NASA-grade: courbe exponentielle pour un score toujours lisible
    # Score = 100 * e^(-penalty/200)
    # - 0 penalty = 100
    # - 200 penalty = 37
    # - 400 penalty = 14
    import math
    score = 100 * math.exp(-max(0, total_penalty) / 200)

    return max(0, min(100, int(score)))

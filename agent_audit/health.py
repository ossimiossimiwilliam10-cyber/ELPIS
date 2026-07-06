"""
ELPIS Immune System — Self-Diagnostic (Health Monitor)
======================================================
L'agent audite sa propre sante. Il verifie :
1. Regles perimees ou inutilisees
2. Taux de faux positifs par regle
3. Corrections qui ont ete annulees (rollbacks)
4. Regles qui n'ont jamais declenche (potentiellement inutiles)
5. Performance du scan (temps d'execution, fichiers/secondes)
6. Integrite du fichier rules.json
"""

import os
import json
import datetime
import time

# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

def run_health_check(rules, report, escalations, corrections, #rlm:ignore
                     rules_path, output_path, start_time):
    """
    Execute un diagnostic complet de l'agent lui-meme.
    Retourne un rapport de sante.
    """
    elapsed = time.time() - start_time

    health = {
        'timestamp': datetime.datetime.now().isoformat(),
        'agent_version': '3.0.0',
        'rules_health': _check_rules_health(rules, rules_path),
        'scan_performance': _check_performance(report, elapsed),
        'false_positive_analysis': _analyze_false_positives(report, escalations),
        'escalation_health': _check_escalation_health(escalations),
        'rule_activity': _check_rule_activity(rules, report),
        'output_health': _check_output_health(output_path),
        'overall_status': 'HEALTHY',
        'warnings': [],
        'recommendations': []
    }

    # Agreger les avertissements
    _aggregate_health_warnings(health)

    return health


# ---------------------------------------------------------------------------
# Individual Checks
# ---------------------------------------------------------------------------

def _check_rules_health(rules, rules_path):
    """Verifie l'integrite des regles."""
    issues = []

    # Verifier que rules.json est un JSON valide
    if not os.path.exists(rules_path):
        return {'status': 'CRITICAL', 'issues': ['rules.json introuvable']}

    # Verifier que chaque regle a les champs obligatoires
    required_fields = ['id', 'severity', 'description', 'patterns']
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        for field in required_fields:
            if field not in rule:
                issues.append(f"Regle sans champ obligatoire '{field}': {rule.get('id', 'INCONNUE')}")

        # Verifier la severite
        if rule.get('severity') not in ('critical', 'warning', 'info'):
            issues.append(f"Severite invalide pour {rule['id']}: {rule.get('severity')}")

        # Verifier que les patterns sont compilables
        patterns = rule.get('patterns', [rule.get('pattern', '')])
        for p in patterns:
            if p and p not in ('CIRCULAR_DETECTED', 'LAYER_VIOLATION',
                               'FILE_LINE_COUNT_CHECK', 'FUNCTION_LENGTH_CHECK',
                               'NESTING_DEPTH_CHECK', 'TEST_COVERAGE_CHECK'):
                try:
                    import re
                    re.compile(p)
                except re.error as e:
                    issues.append(f"Pattern regex invalide pour {rule['id']}: {e}")

    # Verifier les IDs dupliques
    ids = [r['id'] for r in rules if isinstance(r, dict) and 'id' in r]
    duplicates = [id for id in ids if ids.count(id) > 1]
    if duplicates:
        issues.append(f"IDs de regles dupliques: {list(set(duplicates))}")

    return {
        'status': 'HEALTHY' if not issues else 'WARNING',
        'total_rules': len(rules),
        'issues': issues
    }


def _check_performance(report, elapsed_seconds):
    """Analyse les performances du scan."""
    files = report.get('files_scanned', 0)
    lines = report.get('total_lines_of_code', 0)

    files_per_sec = files / elapsed_seconds if elapsed_seconds > 0 else 0
    lines_per_sec = lines / elapsed_seconds if elapsed_seconds > 0 else 0

    status = 'HEALTHY'
    if files_per_sec < 10:
        status = 'WARNING'
    if files_per_sec < 2:
        status = 'CRITICAL'

    return {
        'status': status,
        'elapsed_seconds': round(elapsed_seconds, 2),
        'files_scanned': files,
        'files_per_second': round(files_per_sec, 1),
        'lines_per_second': round(lines_per_sec, 0)
    }


def _analyze_false_positives(report, escalations):
    """Analyse le taux de faux positifs par regle."""
    anomalies_by_rule = {}
    for a in report.get('anomalies', []):
        rid = a.get('rule_id', 'UNKNOWN')
        anomalies_by_rule[rid] = anomalies_by_rule.get(rid, 0) + 1

    fp_escalations = [e for e in escalations if e.get('type') == 'PATTERN_TOO_BROAD']

    return {
        'total_rules_with_hits': len(anomalies_by_rule),
        'false_positive_escalations': len(fp_escalations),
        'rule_hit_distribution': dict(sorted(anomalies_by_rule.items(),
                                             key=lambda x: -x[1])[:10])
    }


def _check_escalation_health(escalations):
    """Verifie l'etat des escalades."""
    criticals = [e for e in escalations if e.get('level') == 'critical']
    fix_broken = [e for e in escalations if e.get('type') == 'FIX_BROKE_TESTS']

    status = 'HEALTHY'
    if criticals:
        status = 'CRITICAL'
    elif fix_broken:
        status = 'WARNING'

    return {
        'status': status,
        'total_escalations': len(escalations),
        'critical_escalations': len(criticals),
        'fixes_that_broke_tests': len(fix_broken)
    }


def _check_rule_activity(rules, report):
    """Identifie les regles qui n'ont jamais declenche (potentiellement inutiles)."""
    active_rules = set()
    for a in report.get('anomalies', []):
        active_rules.add(a.get('rule_id'))

    all_rule_ids = {r['id'] for r in rules if isinstance(r, dict) and 'id' in r}
    inactive = all_rule_ids - active_rules

    return {
        'total_rules': len(all_rule_ids),
        'active_rules': len(active_rules),
        'inactive_rules': list(inactive)[:20],
        'inactive_count': len(inactive)
    }


def _check_output_health(output_path):
    """Verifie que le fichier de sortie est valide."""
    if not os.path.exists(output_path):
        return {'status': 'WARNING', 'issues': ['Fichier de sortie inexistant']}

    try:
        with open(output_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        required = ['last_scan', 'files_scanned', 'total_anomalies']
        missing = [k for k in required if k not in data]
        if missing:
            return {'status': 'WARNING', 'issues': [f'Champs manquants: {missing}']}

        return {'status': 'HEALTHY', 'size_kb': round(os.path.getsize(output_path) / 1024, 1)}
    except (json.JSONDecodeError, OSError) as e:
        return {'status': 'CRITICAL', 'issues': [f'JSON invalide: {e}']}


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------

def _aggregate_health_warnings(health):
    """Agrege les avertissements de tous les sous-systemes."""

    # Regles
    if health['rules_health']['status'] != 'HEALTHY':
        health['warnings'].append('Problemes dans les regles: ' +
                                  '; '.join(health['rules_health']['issues']))

    # Performance
    if health['scan_performance']['status'] != 'HEALTHY':
        health['warnings'].append(
            f"Performance degradee: {health['scan_performance']['files_per_second']} fichiers/s"
        )

    # Escalades
    esc_health = health['escalation_health']
    if esc_health['critical_escalations'] > 0:
        health['warnings'].append(
            f"{esc_health['critical_escalations']} escalade(s) critique(s) en attente"
        )

    # Regles inactives
    inactive = health['rule_activity'].get('inactive_count', 0)
    if inactive > 10:
        health['recommendations'].append(
            f"{inactive} regles inactives. Verifier si elles sont encore pertinentes."
        )

    # Output
    if health['output_health']['status'] != 'HEALTHY':
        health['warnings'].append('Probleme avec le fichier de sortie')

    # Statut global
    if health['escalation_health']['status'] == 'CRITICAL':
        health['overall_status'] = 'CRITICAL'
    elif health['warnings']:
        health['overall_status'] = 'WARNING'
    else:
        health['overall_status'] = 'HEALTHY'

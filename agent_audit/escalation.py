"""
ELPIS Immune System — Escalation Protocol
=========================================
Quand l'agent ne peut pas corriger une anomalie, il escalade avec :
1. Un diagnostic precis (pourquoi c'est non corrigible)
2. Une suggestion d'amelioration de la regle
3. Un niveau d'urgence (standard / eleve / critique)
4. Une recommandation actionnable pour l'humain

Types d'escalade :
- UNFIXABLE           : L'agent ne sait pas corriger (requires_human=True)
- LOW_CONFIDENCE      : Le fix_confidence est trop bas
- FIX_BROKE_TESTS     : La correction a casse les tests (rollback)
- PATTERN_TOO_BROAD   : La regle produit trop de faux positifs
- EMERGENCY           : Alerte critique immediate (secrets, eval, etc.)
- RULE_SUGGESTION     : L'agent suggere une amelioration de regle
"""

import datetime
import json
import os

ESCALATION_LOG_PATH = None  # Set by main.py

def set_escalation_log(path):
    global ESCALATION_LOG_PATH
    ESCALATION_LOG_PATH = path

# ---------------------------------------------------------------------------
# Escalation Types
# ---------------------------------------------------------------------------

class EscalationLevel:
    STANDARD = 'standard'
    ELEVATED = 'elevated'
    CRITICAL = 'critical'

def create_escalation(anomaly, rule, reason_type, details=None):
    """
    Cree un enregistrement d'escalade structure.
    """
    escalation = {
        'timestamp': datetime.datetime.now().isoformat(),
        'type': reason_type,
        'level': _determine_level(anomaly, rule, reason_type),
        'rule_id': anomaly.get('rule_id', 'UNKNOWN'),
        'file': anomaly.get('file', ''),
        'line': anomaly.get('line', 0),
        'code_snippet': anomaly.get('code_snippet', ''),
        'diagnosis': _build_diagnosis(anomaly, rule, reason_type),
        'recommendation': _build_recommendation(anomaly, rule, reason_type),
        'rule_improvement_suggestion': _suggest_rule_improvement(anomaly, rule, reason_type),
        'details': details or {}
    }

    # Logger l'escalade
    _log_escalation(escalation)

    return escalation


def _determine_level(anomaly, rule, reason_type):
    """Determine le niveau d'urgence de l'escalade."""
    if reason_type == 'EMERGENCY':
        return EscalationLevel.CRITICAL
    if rule and rule.get('severity') == 'critical':
        return EscalationLevel.ELEVATED
    if reason_type == 'FIX_BROKE_TESTS':
        return EscalationLevel.ELEVATED
    return EscalationLevel.STANDARD

# ---------------------------------------------------------------------------
# Diagnostics
# ---------------------------------------------------------------------------

def _build_diagnosis(anomaly, rule, reason_type):
    """Construit un diagnostic humain expliquant pourquoi l'agent ne peut pas corriger."""

    diagnoses = {
        'UNFIXABLE': (
            f"La regle '{anomaly.get('rule_id')}' a detecte une anomalie, "
            f"mais la correction automatique est desactivee (requires_human: true). "
            f"Raison probable : la correction est trop contextuelle ou risquee pour etre automatisee."
        ),
        'LOW_CONFIDENCE': (
            f"La regle '{anomaly.get('rule_id')}' propose une correction automatique, "
            f"mais le score de confiance ({rule.get('fix_confidence', 0)}%) est inferieur au seuil "
            f"de securite (70%). La correction automatique pourrait introduire un bug."
        ),
        'FIX_BROKE_TESTS': (
            f"La correction appliquee pour la regle '{anomaly.get('rule_id')}' a ete annulee "
            f"car les tests ont echoue apres modification. Le fichier a ete restaure depuis le backup. "
            f"Ceci indique que la correction etait incorrecte ou incomplete."
        ),
        'PATTERN_TOO_BROAD': (
            f"La regle '{anomaly.get('rule_id')}' a declenche plus de 3 faux positifs. "
            f"Le pattern de detection est probablement trop large et necessite un ajustement."
        ),
        'EMERGENCY': (
            f"ALERTE CRITIQUE : L'anomalie detectee par '{anomaly.get('rule_id')}' "
            f"represente un risque de securite immediat. Intervention humaine obligatoire. "
            f"L'agent ne modifie jamais les secrets/credentials automatiquement."
        ),
        'RULE_SUGGESTION': (
            f"L'agent suggere une amelioration de la regle '{anomaly.get('rule_id')}'. "
            f"Le pattern actuel pourrait etre affine pour reduire les faux positifs."
        )
    }

    return diagnoses.get(reason_type, f"Escalade de type '{reason_type}' pour la regle {anomaly.get('rule_id')}.")

# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------

def _build_recommendation(anomaly, rule, reason_type):
    """Construit une recommandation actionnable pour le developpeur."""

    rule_id = anomaly.get('rule_id', 'UNKNOWN')
    file = anomaly.get('file', '')
    line = anomaly.get('line', 0)
    suppression = rule.get('suppression_comment', '') if rule else ''

    recommendations = {
        'UNFIXABLE': (
            f"1. Ouvrir le fichier {file} a la ligne {line}\n"
            f"2. Corriger manuellement selon la description de la regle\n"
            f"3. OU si c'est un faux positif, ajouter le commentaire "
            f"'{suppression}' sur la ligne precedente"
        ),
        'LOW_CONFIDENCE': (
            f"1. Verifier l'anomalie dans {file}:{line}\n"
            f"2. Si la correction proposee est correcte, l'appliquer manuellement\n"
            f"3. Si le pattern est trop large, ajuster la regle dans rules.json"
        ),
        'FIX_BROKE_TESTS': (
            f"1. Verifier le fichier {file} et comprendre pourquoi le fix a casse les tests\n"
            f"2. Corriger manuellement avec une approche plus nuancee\n"
            f"3. Verifier que les tests passent avant de commiter"
        ),
        'EMERGENCY': (
            f"1. ACTION IMMEDIATE REQUISE : {file}:{line}\n"
            f"2. Verifier s'il s'agit d'un vrai secret (si oui, le revoquer immediatement)\n"
            f"3. Remplacer par process.env.VARIABLE\n"
            f"4. Ajouter le fichier au .gitignore si necessaire"
        ),
    }

    return recommendations.get(reason_type,
        f"Examiner {file}:{line} et corriger selon la regle {rule_id}.")

# ---------------------------------------------------------------------------
# Rule Improvement Suggestions
# ---------------------------------------------------------------------------

def _suggest_rule_improvement(anomaly, rule, reason_type):
    """Suggere des ameliorations de regle quand c'est pertinent."""
    if reason_type not in ('PATTERN_TOO_BROAD', 'LOW_CONFIDENCE', 'RULE_SUGGESTION'):
        return None

    if not rule:
        return None

    suggestion = {
        'rule_id': rule['id'],
        'current_patterns': rule.get('patterns', []),
        'suggested_action': None,
        'reason': None
    }

    if reason_type == 'PATTERN_TOO_BROAD':
        suggestion['suggested_action'] = 'Ajouter un exclude_pattern plus precis ou restreindre le file_pattern'
        suggestion['reason'] = 'La regle produit trop de faux positifs (3+)'
    elif reason_type == 'LOW_CONFIDENCE':
        suggestion['suggested_action'] = 'Augmenter le fix_confidence si la correction est fiable, ou ajouter un test de validation'
        suggestion['reason'] = 'Le fix_confidence est sous le seuil de 70%'

    return suggestion


# ---------------------------------------------------------------------------
# Emergency Mode
# ---------------------------------------------------------------------------

EMERGENCY_ALERT_FILE = None

def set_emergency_alert_file(path):
    global EMERGENCY_ALERT_FILE
    EMERGENCY_ALERT_FILE = path

def trigger_emergency(anomaly, rule):
    """
    Alerte critique immediate. Cree un fichier d'alerte visible dans le dashboard.
    """
    alert = {
        'timestamp': datetime.datetime.now().isoformat(),
        'type': 'EMERGENCY',
        'rule_id': rule['id'],
        'cwe_ref': rule.get('cwe_ref'),
        'file': anomaly.get('file'),
        'line': anomaly.get('line'),
        'description': anomaly.get('description'),
        'action_required': 'IMMEDIATE',
        'message': f'CRITICAL: {rule["id"]} detected in {anomaly.get("file")}:{anomaly.get("line")}'
    }

    if EMERGENCY_ALERT_FILE:
        alerts = []
        if os.path.exists(EMERGENCY_ALERT_FILE):
            try:
                with open(EMERGENCY_ALERT_FILE, 'r') as f:
                    alerts = json.load(f)
            except (json.JSONDecodeError, OSError):
                alerts = []
        alerts.append(alert)
        os.makedirs(os.path.dirname(EMERGENCY_ALERT_FILE), exist_ok=True)
        with open(EMERGENCY_ALERT_FILE, 'w') as f:
            json.dump(alerts, f, indent=2)

    return alert

# ---------------------------------------------------------------------------
# Escalation Logging
# ---------------------------------------------------------------------------

def _log_escalation(escalation):
    """Ecrit l'escalade dans le fichier de log."""
    if not ESCALATION_LOG_PATH:
        return
    try:
        os.makedirs(os.path.dirname(ESCALATION_LOG_PATH), exist_ok=True)
        with open(ESCALATION_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(escalation, ensure_ascii=False) + '\n')
    except (PermissionError, OSError):
        pass


# ---------------------------------------------------------------------------
# Batch Escalation Processing
# ---------------------------------------------------------------------------

def process_escalations(escalations, rules):
    """
    Traite une liste d'escalades et retourne des statistiques.
    """
    by_type = {}
    by_level = {}
    emergencies = []

    for esc in escalations:
        t = esc.get('type', 'UNKNOWN')
        by_type[t] = by_type.get(t, 0) + 1

        lvl = esc.get('level', 'standard')
        by_level[lvl] = by_level.get(lvl, 0) + 1

        if lvl == 'critical':
            emergencies.append(esc)

    return {
        'total': len(escalations),
        'by_type': by_type,
        'by_level': by_level,
        'emergencies': emergencies,
        'emergency_count': len(emergencies)
    }

"""
ELPIS Immune System — Trending & History (v1.0)
================================================
Analyse les rapports d'audit successifs pour détecter les tendances.

Fonctionnalités :
1. Courbe du health score (amélioration ou dégradation)
2. Top 5 règles qui s'aggravent
3. Nouveaux types d'anomalies apparues
4. Ratio correction/escapade dans le temps
5. Prédiction simple (régression linéaire) du health score à J+7
"""

import os
import json

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
AUDIT_FILE = os.path.join(PROJECT_ROOT, 'data', 'espoir_audit.json')

# ---------------------------------------------------------------------------
# Chargement de l'historique
# ---------------------------------------------------------------------------

def load_audit_history(max_runs=10):
    """
    Charge les N derniers rapports d'audit.
    Pour l'instant, on simule un historique à partir du fichier unique.
    Dans le futur, on archivera chaque run avec un timestamp dans le nom.
    """
    history = []
    
    # Chercher des fichiers d'historique
    data_dir = os.path.join(PROJECT_ROOT, 'data')
    if not os.path.exists(data_dir):
        return history
    
    # Pattern: espoir_audit.json, espoir_audit_2026-07-*.json
    audit_files = []
    for f in os.listdir(data_dir):
        if f.startswith('espoir_audit') and f.endswith('.json'):
            audit_files.append(os.path.join(data_dir, f))
    
    audit_files.sort(reverse=True)
    
    for audit_path in audit_files[:max_runs]:
        try:
            with open(audit_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            data['_source_file'] = os.path.basename(audit_path)
            history.append(data)
        except (json.JSONDecodeError, OSError):
            continue
    
    return history


# ---------------------------------------------------------------------------
# Analyse de tendances
# ---------------------------------------------------------------------------

def analyze_trends(history):
    """
    Analyse les tendances à partir de l'historique des rapports.
    
    Retourne un dictionnaire structuré.
    """
    if len(history) < 2:
        return {
            'status': 'INSUFFICIENT_DATA',
            'message': f'Besoin d\'au moins 2 runs. Actuellement: {len(history)}.',
            'runs_available': len(history),
        }
    
    latest = history[0]
    previous = history[1]
    oldest = history[-1]
    
    trends = {
        'status': 'OK',
        'runs_analyzed': len(history),
        'date_range': {
            'oldest': oldest.get('last_scan', 'inconnu'),
            'latest': latest.get('last_scan', 'inconnu'),
        },
        'health_score': _analyze_health_trend(history),
        'anomalies': _analyze_anomaly_trend(history),
        'top_worsening_rules': _analyze_worsening_rules(history),
        'new_anomaly_types': _analyze_new_types(latest, previous),
        'fix_efficiency': _analyze_fix_efficiency(history),
        'prediction': _predict_health_score(history),
        'recommendations': [],
    }
    
    # Générer des recommandations
    trends['recommendations'] = _generate_recommendations(trends)
    
    return trends


def _analyze_health_trend(history):
    """Analyse la tendance du health score."""
    scores = []
    for h in reversed(history):  # Du plus ancien au plus récent
        score = h.get('health_score')
        if score is not None:
            scores.append(score)
    
    if len(scores) < 2:
        return {'trend': 'stable', 'current': scores[0] if scores else 0, 'change': 0}
    
    current = scores[-1]
    previous = scores[-2]
    delta = current - previous
    
    if delta > 5:
        trend = 'strongly_improving'
    elif delta > 1:
        trend = 'improving'
    elif delta < -5:
        trend = 'strongly_declining'
    elif delta < -1:
        trend = 'declining'
    else:
        trend = 'stable'
    
    return {
        'trend': trend,
        'current': current,
        'previous': previous,
        'delta': delta,
        'all_scores': scores,
    }


def _analyze_anomaly_trend(history):
    """Analyse la tendance du nombre total d'anomalies."""
    totals = []
    by_severity = {'critical': [], 'warning': [], 'info': []}
    
    for h in reversed(history):
        totals.append(h.get('total_anomalies', 0))
        sev = h.get('anomalies_by_severity', {})
        by_severity['critical'].append(sev.get('critical', 0))
        by_severity['warning'].append(sev.get('warning', 0))
        by_severity['info'].append(sev.get('info', 0))
    
    if len(totals) < 2:
        return {'trend': 'stable'}
    
    current_total = totals[-1]
    previous_total = totals[-2]
    
    delta_pct = ((current_total - previous_total) / max(previous_total, 1)) * 100
    
    if delta_pct < -20:
        trend = 'strongly_improving'
    elif delta_pct < -5:
        trend = 'improving'
    elif delta_pct > 20:
        trend = 'strongly_declining'
    elif delta_pct > 5:
        trend = 'declining'
    else:
        trend = 'stable'
    
    return {
        'trend': trend,
        'current_total': current_total,
        'previous_total': previous_total,
        'delta_pct': round(delta_pct, 1),
        'by_severity_current': {
            'critical': by_severity['critical'][-1] if by_severity['critical'] else 0,
            'warning': by_severity['warning'][-1] if by_severity['warning'] else 0,
            'info': by_severity['info'][-1] if by_severity['info'] else 0,
        }
    }


def _analyze_worsening_rules(history):
    """Identifie les règles qui s'aggravent le plus."""
    if len(history) < 2:
        return []
    
    latest_rules = history[0].get('rule_stats', {})
    previous_rules = history[1].get('rule_stats', {}) if len(history) > 1 else {}
    
    worsening = []
    
    for rule_id, stats in latest_rules.items():
        current_count = stats.get('count', 0)
        prev_stats = previous_rules.get(rule_id, {})
        prev_count = prev_stats.get('count', 0)
        
        if current_count > prev_count and current_count >= 3:
            delta = current_count - prev_count
            pct_increase = (delta / max(prev_count, 1)) * 100
            worsening.append({
                'rule_id': rule_id,
                'severity': stats.get('severity', 'info'),
                'current_count': current_count,
                'previous_count': prev_count,
                'delta': delta,
                'pct_increase': round(pct_increase, 1),
            })
    
    worsening.sort(key=lambda x: -x['delta'])
    return worsening[:5]


def _analyze_new_types(latest, previous):
    """Détecte les nouveaux types d'anomalies apparues depuis le run précédent."""
    latest_rules = set(latest.get('rule_stats', {}).keys())
    previous_rules = set(previous.get('rule_stats', {}).keys())
    
    new_rules = latest_rules - previous_rules
    
    result = []
    for rule_id in new_rules:
        stats = latest.get('rule_stats', {}).get(rule_id, {})
        result.append({
            'rule_id': rule_id,
            'severity': stats.get('severity', 'info'),
            'count': stats.get('count', 0),
            'category': stats.get('category', 'UNKNOWN'),
        })
    
    return sorted(result, key=lambda x: -x['count'])


def _analyze_fix_efficiency(history):
    """Analyse l'efficacité des corrections (ratio corrigé/détecté)."""
    ratios = []
    
    for h in history:
        anomalies = h.get('total_anomalies', 0)
        corrections = h.get('total_corrections', 0)
        ratio = (corrections / max(anomalies, 1)) * 100
        ratios.append(round(ratio, 1))
    
    if len(ratios) < 2:
        return {'trend': 'stable', 'current_ratio_pct': ratios[0] if ratios else 0}
    
    return {
        'trend': 'improving' if ratios[-1] > ratios[-2] else 'declining' if ratios[-1] < ratios[-2] else 'stable',
        'current_ratio_pct': ratios[-1],
        'previous_ratio_pct': ratios[-2],
        'all_ratios': ratios,
    }


def _predict_health_score(history):
    """
    Prédit le health score à J+7 avec une régression linéaire simple.
    y = mx + b sur les N derniers points.
    """
    scores = []
    for h in reversed(history):
        score = h.get('health_score')
        if score is not None:
            scores.append(score)
    
    if len(scores) < 3:
        return {'prediction_possible': False, 'message': 'Besoin d\'au moins 3 points.'}
    
    n = len(scores)
    x_mean = (n - 1) / 2
    y_mean = sum(scores) / n
    
    # Calcul de la pente m
    numerator = sum((i - x_mean) * (scores[i] - y_mean) for i in range(n))
    denominator = sum((i - x_mean) ** 2 for i in range(n))
    
    if denominator == 0:
        return {'prediction_possible': False, 'message': 'Données constantes.'}
    
    m = numerator / denominator
    b = y_mean - m * x_mean
    
    # Prédiction à n+7 (dans 7 runs)
    next_x = n + 6  # +7 runs depuis le début, -1 car 0-indexed
    predicted = m * next_x + b
    
    # Limiter à [0, 100]
    predicted = max(0, min(100, predicted))
    
    # Tendance
    if m > 0.5:
        trend = 'improving'
    elif m < -0.5:
        trend = 'declining'
    else:
        trend = 'stable'
    
    return {
        'prediction_possible': True,
        'predicted_score_7runs': round(predicted, 1),
        'slope': round(m, 3),
        'trend': trend,
        'confidence': 'low' if n < 5 else 'medium' if n < 10 else 'high',
    }


def _generate_recommendations(trends):
    """Génère des recommandations en fonction des tendances."""
    recs = []
    
    # Health score
    hs = trends.get('health_score', {})
    if hs.get('trend') in ('declining', 'strongly_declining'):
        recs.append("⚠️ Le health score est en baisse. Prioriser les corrections de bugs critiques.")
    
    # Anomalies
    anom = trends.get('anomalies', {})
    if anom.get('trend') in ('declining', 'strongly_declining'):
        recs.append("📈 Le nombre d'anomalies augmente. Vérifier les nouvelles règles ou la qualité du code récent.")
    
    # Règles aggravées
    worsening = trends.get('top_worsening_rules', [])
    if worsening:
        top = worsening[0]
        recs.append(f"🔴 Règle '{top['rule_id']}' en hausse ({top['delta']} de plus). Investiguer la cause.")
    
    # Efficacité des fixes
    fix_eff = trends.get('fix_efficiency', {})
    if fix_eff.get('trend') == 'declining':
        recs.append("🔧 L'efficacité des corrections automatiques diminue. Plus d'escalades manuelles nécessaires.")
    
    # Nouveaux types
    new_types = trends.get('new_anomaly_types', [])
    if new_types:
        recs.append(f"🆕 {len(new_types)} nouveaux types d'anomalies détectés. Vérifier s'ils sont légitimes.")
    
    if not recs:
        recs.append("✅ Toutes les tendances sont stables ou en amélioration. Continuer ainsi.")
    
    return recs


# ---------------------------------------------------------------------------
# Formatage
# ---------------------------------------------------------------------------

def format_trending_report(trends, history):
    """Formate un rapport de tendances lisible."""
    lines = []
    lines.append("=" * 60)
    lines.append("  RAPPORT DE TENDANCES — Immune System v5.0")
    lines.append("=" * 60)
    lines.append(f"  Runs analysés : {trends.get('runs_analyzed', 0)}")
    
    date_range = trends.get('date_range', {})
    lines.append(f"  Période : {date_range.get('oldest', '?')} → {date_range.get('latest', '?')}")
    lines.append("")
    
    # Health Score
    hs = trends.get('health_score', {})
    emoji = {'strongly_improving': '🟢🟢', 'improving': '🟢', 'stable': '🟡',
             'declining': '🔴', 'strongly_declining': '🔴🔴'}.get(hs.get('trend'), '⚪')
    lines.append(f"  ❤️ Health Score : {hs.get('current', '?')}/100 ({emoji} {hs.get('trend', '?')}, Δ={hs.get('delta', 0):+.1f})")
    
    # Anomalies
    anom = trends.get('anomalies', {})
    lines.append(f"  📊 Anomalies totales : {anom.get('current_total', '?')} ({anom.get('trend', '?')}, {anom.get('delta_pct', 0):+.1f}%)")
    
    sev = anom.get('by_severity_current', {})
    lines.append(f"     Critiques: {sev.get('critical', 0)} | Warnings: {sev.get('warning', 0)} | Info: {sev.get('info', 0)}")
    
    # Top 5 règles aggravées
    worsening = trends.get('top_worsening_rules', [])
    if worsening:
        lines.append("")
        lines.append("  📈 Top règles qui s'aggravent :")
        for i, w in enumerate(worsening):
            lines.append(f"     {i+1}. {w['rule_id']} : {w['previous_count']} → {w['current_count']} (+{w['delta']}, +{w['pct_increase']}%)")
    
    # Nouveaux types
    new_types = trends.get('new_anomaly_types', [])
    if new_types:
        lines.append("")
        lines.append(f"  🆕 Nouveaux types d'anomalies ({len(new_types)}) :")
        for nt in new_types[:5]:
            lines.append(f"     • {nt['rule_id']} ({nt['severity']}) : {nt['count']} occurrences — {nt['category']}")
    
    # Efficacité des fixes
    fix_eff = trends.get('fix_efficiency', {})
    lines.append("")
    lines.append(f"  🔧 Efficacité des corrections : {fix_eff.get('current_ratio_pct', 0):.1f}% ({fix_eff.get('trend', '?')})")
    
    # Prédiction
    pred = trends.get('prediction', {})
    if pred.get('prediction_possible'):
        p_emoji = '🟢' if pred.get('trend') == 'improving' else '🔴' if pred.get('trend') == 'declining' else '🟡'
        lines.append(f"  🔮 Health Score prédit (J+7) : {pred.get('predicted_score_7runs', '?')}/100 ({p_emoji} {pred.get('trend')}, confiance: {pred.get('confidence')})")
    
    # Recommandations
    recs = trends.get('recommendations', [])
    if recs:
        lines.append("")
        lines.append("  💡 Recommandations :")
        for r in recs:
            lines.append(f"     {r}")
    
    lines.append("")
    lines.append("=" * 60)
    return "\n".join(lines)

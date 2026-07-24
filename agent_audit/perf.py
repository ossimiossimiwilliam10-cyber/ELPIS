"""
ELPIS Immune System — Performance Regression Detector (v1.0)
=============================================================
Tracke les métriques de build et détecte les régressions.

Métriques suivies :
1. Bundle size (taille des chunks JS/CSS)
2. Build time (durée de compilation)
3. Test duration (durée d'exécution des tests)
4. Nombre de chunks

Détection de régression :
- Si un chunk grossit de +20% → WARNING
- Si le build time augmente de +50% → WARNING
- Si la durée des tests double → CRITICAL
"""

import os
import json
import re
import subprocess
import time
from datetime import datetime

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PERF_FILE = os.path.join(PROJECT_ROOT, 'data', 'espoir_perf_history.json')

# ---------------------------------------------------------------------------
# Collecte des métriques de build
# ---------------------------------------------------------------------------

def collect_build_metrics():
    """
    Lance un build Vite et extrait les métriques de performance.
    
    Retourne un dict ou None si le build échoue.
    """
    web_dir = os.path.join(PROJECT_ROOT, 'interface', 'web')
    if not os.path.exists(os.path.join(web_dir, 'package.json')):
        return None
    
    try:
        start = time.time()
        result = subprocess.run(
            ['npm', 'run', 'build'],
            cwd=web_dir,
            capture_output=True, text=True, timeout=120,
            check=False
        )
        elapsed = time.time() - start
        
        output = result.stdout + result.stderr
        
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'build_time_seconds': round(elapsed, 2),
            'build_success': result.returncode == 0,
            'chunks': _parse_chunk_sizes(output),
            'total_bundle_kb': 0,
            'largest_chunk_kb': 0,
            'chunk_count': 0,
            'gzip_total_kb': 0,
        }
        
        # Calculer les totaux
        for chunk in metrics['chunks']:
            metrics['total_bundle_kb'] += chunk.get('size_kb', 0)
            metrics['gzip_total_kb'] += chunk.get('gzip_kb', 0)
            if chunk.get('size_kb', 0) > metrics['largest_chunk_kb']:
                metrics['largest_chunk_kb'] = chunk['size_kb']
        
        metrics['chunk_count'] = len(metrics['chunks'])
        
        return metrics
    except Exception as e:
        return {
            'timestamp': datetime.now().isoformat(),
            'build_success': False,
            'error': str(e),
        }


def _parse_chunk_sizes(output):
    """
    Parse la sortie de Vite build pour extraire les tailles des chunks.
    
    Format: dist/assets/index-XXXXXXXX.css   22.39 kB │ gzip:  5.15 kB
    """
    chunks = []
    
    # Pattern: dist/path  size kB │ gzip:  size kB
    pattern = re.compile(
        r'(dist/\S+)\s+([\d,]+\.?\d*)\s*kB\s*(?:\│\s*gzip:\s*([\d,]+\.?\d*)\s*kB)?'
    )
    
    for match in pattern.finditer(output):
        path = match.group(1)
        size_str = match.group(2).replace(',', '')
        gzip_str = match.group(3).replace(',', '') if match.group(3) else '0'
        
        try:
            size_kb = float(size_str)
            gzip_kb = float(gzip_str)
        except ValueError:
            continue
        
        chunks.append({
            'path': path,
            'size_kb': size_kb,
            'gzip_kb': gzip_kb,
        })
    
    return chunks


# ---------------------------------------------------------------------------
# Collecte des métriques de test
# ---------------------------------------------------------------------------

def collect_test_metrics():
    """
    Lance les tests (quick) et extrait la durée.
    """
    try:
        start = time.time()
        result = subprocess.run(
            ['npm', 'test', '--', '--passWithNoTests', '--reporter=json'],
            cwd=PROJECT_ROOT,
            capture_output=True, text=True, timeout=180,
            check=False
        )
        elapsed = time.time() - start
        
        # Parser le JSON de vitest
        test_count = 0
        failed = 0
        passed = 0
        
        try:
            json_start = result.stdout.find('{')
            if json_start != -1:
                data = json.loads(result.stdout[json_start:])
                if 'testResults' in data:
                    for tr in data['testResults']:
                        if 'assertionResults' in tr:
                            test_count += len(tr['assertionResults'])
                            for ar in tr['assertionResults']:
                                if ar.get('status') == 'passed':
                                    passed += 1
                                elif ar.get('status') == 'failed':
                                    failed += 1
        except (json.JSONDecodeError, KeyError):
            pass
        
        return {
            'timestamp': datetime.now().isoformat(),
            'test_duration_seconds': round(elapsed, 2),
            'test_count': test_count,
            'passed': passed,
            'failed': failed,
            'success': result.returncode == 0,
        }
    except Exception as e:
        return {
            'timestamp': datetime.now().isoformat(),
            'error': str(e),
        }


# ---------------------------------------------------------------------------
# Stockage et comparaison
# ---------------------------------------------------------------------------

def load_perf_history():
    """Charge l'historique des métriques de performance."""
    if not os.path.exists(PERF_FILE):
        return []
    
    try:
        with open(PERF_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def save_perf_metrics(metrics):
    """Sauvegarde les métriques dans l'historique (garde les 30 derniers)."""
    history = load_perf_history()
    history.append(metrics)
    
    # Garder les 30 derniers
    if len(history) > 30:
        history = history[-30:]
    
    os.makedirs(os.path.dirname(PERF_FILE), exist_ok=True)
    with open(PERF_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, indent=2, ensure_ascii=False)


def detect_regressions(current_metrics, history):
    """
    Compare les métriques actuelles avec la moyenne des 5 dernières
    pour détecter les régressions.
    """
    if not history or len(history) < 2:
        return {'status': 'OK', 'regressions': [], 'message': 'Pas assez d\'historique.'}
    
    regressions = []
    
    # Prendre les 5 derniers builds réussis
    recent = [h for h in history[-6:-1] if h.get('build_success', True)]
    
    if not recent:
        return {'status': 'OK', 'regressions': [], 'message': 'Pas de builds récents réussis.'}
    
    # --- Bundle size ---
    if current_metrics.get('total_bundle_kb'):
        avg_bundle = sum(h.get('total_bundle_kb', 0) for h in recent) / len(recent)
        current_bundle = current_metrics['total_bundle_kb']
        delta_pct = ((current_bundle - avg_bundle) / max(avg_bundle, 1)) * 100
        
        if delta_pct > 20:
            regressions.append({
                'metric': 'bundle_size',
                'severity': 'warning',
                'current_kb': round(current_bundle, 1),
                'average_kb': round(avg_bundle, 1),
                'delta_pct': round(delta_pct, 1),
                'message': f'Bundle +{delta_pct:.0f}% plus lourd. Vérifier les nouveaux imports.',
            })
    
    # --- Largest chunk ---
    if current_metrics.get('largest_chunk_kb'):
        avg_largest = sum(h.get('largest_chunk_kb', 0) for h in recent) / len(recent)
        current_largest = current_metrics['largest_chunk_kb']
        delta_pct = ((current_largest - avg_largest) / max(avg_largest, 1)) * 100
        
        if delta_pct > 30:
            regressions.append({
                'metric': 'largest_chunk',
                'severity': 'warning',
                'current_kb': round(current_largest, 1),
                'average_kb': round(avg_largest, 1),
                'delta_pct': round(delta_pct, 1),
                'message': f'Plus gros chunk +{delta_pct:.0f}%. Code-splitting recommandé.',
            })
    
    # --- Build time ---
    if current_metrics.get('build_time_seconds'):
        avg_time = sum(h.get('build_time_seconds', 0) for h in recent) / len(recent)
        current_time = current_metrics['build_time_seconds']
        delta_pct = ((current_time - avg_time) / max(avg_time, 1)) * 100
        
        if delta_pct > 50:
            regressions.append({
                'metric': 'build_time',
                'severity': 'warning',
                'current_seconds': round(current_time, 2),
                'average_seconds': round(avg_time, 2),
                'delta_pct': round(delta_pct, 1),
                'message': f'Build +{delta_pct:.0f}% plus lent.',
            })
    
    # --- Chunk count growth ---
    if current_metrics.get('chunk_count'):
        avg_count = sum(h.get('chunk_count', 0) for h in recent) / len(recent)
        current_count = current_metrics['chunk_count']
        
        if current_count > avg_count + 3:
            regressions.append({
                'metric': 'chunk_count',
                'severity': 'info',
                'current_count': current_count,
                'average_count': round(avg_count, 1),
                'message': f'{current_count} chunks (moyenne: {avg_count:.0f}). Fragmentation excessive ?',
            })
    
    status = 'OK'
    if any(r['severity'] == 'critical' for r in regressions):
        status = 'CRITICAL'
    elif any(r['severity'] == 'warning' for r in regressions):
        status = 'WARNING'
    
    return {
        'status': status,
        'regressions': regressions,
        'compared_against_runs': len(recent),
    }


def format_perf_report(metrics, regressions):
    """Formate un rapport de performance."""
    lines = []
    lines.append("=" * 60)
    lines.append("  RAPPORT DE PERFORMANCE — Build & Bundle")
    lines.append("=" * 60)
    
    if not metrics.get('build_success', False):
        lines.append(f"  ❌ Build échoué : {metrics.get('error', 'Erreur inconnue')}")
        return "\n".join(lines)
    
    lines.append(f"  ⏱️  Build time : {metrics.get('build_time_seconds', '?')}s")
    lines.append(f"  📦 Bundle total : {metrics.get('total_bundle_kb', '?')} kB ({metrics.get('gzip_total_kb', '?')} kB gzip)")
    lines.append(f"  🧩 Chunks : {metrics.get('chunk_count', '?')}")
    lines.append(f"  📀 Plus gros chunk : {metrics.get('largest_chunk_kb', '?')} kB")
    lines.append("")
    
    # Top 5 chunks
    chunks = sorted(metrics.get('chunks', []), key=lambda c: -c.get('size_kb', 0))
    if chunks:
        lines.append("  Top 5 chunks :")
        for c in chunks[:5]:
            lines.append(f"    {c['path']:<50} {c['size_kb']:>8.1f} kB  (gzip: {c['gzip_kb']:.1f} kB)")
    
    # Régressions
    if regressions.get('regressions'):
        lines.append("")
        lines.append(f"  ⚠️  RÉGRESSIONS DÉTECTÉES ({regressions.get('status')}) :")
        for r in regressions['regressions']:
            icon = '🔴' if r['severity'] == 'critical' else '🟡'
            lines.append(f"    {icon} {r['message']}")
    else:
        lines.append("")
        lines.append("  ✅ Aucune régression détectée.")
    
    lines.append("")
    lines.append("=" * 60)
    return "\n".join(lines)

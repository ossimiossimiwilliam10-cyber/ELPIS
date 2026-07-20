"""
ELPIS Immune System — Test Auto-Generator (v1.0)
=================================================
Génère des squelettes de test pour les fichiers source qui n'en ont pas.

Stratégie par type de fichier :
- .jsx/.tsx (composants React) → test avec @testing-library/react + render + "should render"
- .js/.ts  (hooks, utilitaires)→ test avec describe/it + "should be defined" par export
- .py      (Python)           → test avec pytest/unittest + "test_<fonction>_exists"
"""

import os
import re
import json
from datetime import datetime
from collections import defaultdict

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# ---------------------------------------------------------------------------
# Core: Generate test skeleton
# ---------------------------------------------------------------------------

def generate_test_for_file(filepath, source_files, dry_run=True):
    """
    Génère un fichier de test pour un fichier source donné.
    
    Retourne: (test_path, test_content) ou (None, None) si pas nécessaire/impossible.
    """
    ext = os.path.splitext(filepath)[1].lower()
    basename = os.path.basename(filepath)
    
    # Déterminer le nom du fichier de test
    if ext in ('.jsx', '.tsx'):
        test_ext = '.test.jsx'
    elif ext in ('.js', '.ts'):
        test_ext = '.test.js'
    elif ext == '.py':
        test_ext = '_test.py'
    else:
        return None, None
    
    base = os.path.splitext(filepath)[0]
    test_path = base + test_ext
    
    # Vérifier que le test n'existe pas déjà
    test_norm = test_path.replace('\\', '/')
    for sf in source_files:
        if sf.replace('\\', '/') == test_norm:
            return None, None  # Test existe déjà
    
    # Vérifier aussi dans __tests__/
    test_alt = os.path.join(os.path.dirname(filepath), '__tests__', basename)
    test_alt_norm = test_alt.replace('\\', '/')
    for sf in source_files:
        if sf.replace('\\', '/') == test_alt_norm:
            return None, None
    
    # Lire le fichier source pour extraire les exports
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except (PermissionError, OSError):
        return None, None
    
    exports = _extract_exports(filepath, lines)
    imports = _extract_imports_from_file(filepath)
    
    # Générer le contenu du test selon le type
    if ext in ('.jsx', '.tsx'):
        content = _generate_react_test(basename, exports, imports)
    elif ext in ('.js', '.ts'):
        content = _generate_js_test(basename, exports, imports, filepath)
    elif ext == '.py':
        content = _generate_python_test(basename, exports, imports)
    else:
        return None, None
    
    if not dry_run:
        os.makedirs(os.path.dirname(test_path), exist_ok=True)
        with open(test_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return test_path, content


# ---------------------------------------------------------------------------
# Extract exports and imports
# ---------------------------------------------------------------------------

def _extract_exports(filepath, lines):
    """Extrait les exports nommés d'un fichier."""
    exports = []
    ext = os.path.splitext(filepath)[1].lower()
    
    if ext in ('.js', '.jsx', '.ts', '.tsx'):
        for i, line in enumerate(lines):
            # export const/let/var/function/class Name
            match = re.search(r'export\s+(?:const|let|var|function|class)\s+(\w+)', line)
            if match:
                exports.append({'name': match.group(1), 'line': i + 1, 'type': 'named'})
                continue
            
            # export default function/class Name
            match_def = re.search(r'export\s+default\s+(?:function|class)\s+(\w+)', line)
            if match_def:
                exports.append({'name': match_def.group(1), 'line': i + 1, 'type': 'default'})
                continue
            
            # export { Name1, Name2 }
            match_brace = re.search(r'export\s*\{\s*([^}]+)\s*\}', line)
            if match_brace and 'from' not in line:
                names = [n.strip().split(' as ')[0].strip() for n in match_brace.group(1).split(',')]
                for name in names:
                    if name and name != 'default':
                        exports.append({'name': name, 'line': i + 1, 'type': 'named'})
        
        # Si aucun export nommé, chercher un export default (composant)
        if not exports:
            for i, line in enumerate(lines):
                if 'export default' in line:
                    # Trouver le nom de la fonction/composant
                    name_match = re.search(r'export\s+default\s+(?:function|class)\s+(\w+)', line)
                    if name_match:
                        exports.append({'name': name_match.group(1), 'line': i + 1, 'type': 'default'})
                    else:
                        # export default function/component — chercher le nom plus haut
                        exports.append({'name': 'Component', 'line': i + 1, 'type': 'default'})
                    break
    
    elif ext == '.py':
        basename = os.path.basename(filepath)
        for i, line in enumerate(lines):
            match = re.search(r'^(?:async\s+)?def\s+(\w+)\s*\(', line)
            if match and not match.group(1).startswith('_'):
                exports.append({'name': match.group(1), 'line': i + 1, 'type': 'function'})
            match = re.search(r'^class\s+(\w+)', line)
            if match and not match.group(1).startswith('_'):
                exports.append({'name': match.group(1), 'line': i + 1, 'type': 'class'})
    
    return exports


def _extract_imports_from_file(filepath):
    """Extrait les imports pour déterminer les dépendances à mocker."""
    imports = []
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except:
        return imports
    
    ext = os.path.splitext(filepath)[1].lower()
    
    if ext in ('.js', '.jsx', '.ts', '.tsx'):
        for match in re.finditer(r"""import\s+(?:[\w*\s{},]*)\s*from\s*['"]([^'"]+)['"]""", content):
            pkg = match.group(1)
            if pkg not in ('react', 'react-dom') and not pkg.startswith('.'):
                imports.append(pkg)
    
    return imports


# ---------------------------------------------------------------------------
# Test generators by file type
# ---------------------------------------------------------------------------

def _generate_react_test(basename, exports, imports):
    """Génère un test pour un composant React."""
    name_no_ext = os.path.splitext(basename)[0]
    default_export = next((e for e in exports if e['type'] == 'default'), None)
    component_name = default_export['name'] if default_export else (exports[0]['name'] if exports else name_no_ext)
    
    lines = []
    lines.append("import { describe, it, expect, vi } from 'vitest';")
    lines.append("import { render, screen } from '@testing-library/react';")
    lines.append(f"import {component_name} from './{name_no_ext}';")
    lines.append("")
    
    # Mock suggestions basés sur les imports
    for imp in imports:
        pkg_base = imp.split('/')[0]
        if imp.startswith('@'):
            parts = imp.split('/')
            if len(parts) >= 2:
                pkg_base = f"{parts[0]}/{parts[1]}"
        
        if pkg_base in ('zustand', 'react-router-dom', '@hello-pangea/dnd', 'canvas-confetti',
                         'framer-motion', 'recharts', 'three', 'react-force-graph-3d'):
            lines.append(f"vi.mock('{imp}', () => ({{ default: vi.fn() }}));")
    
    lines.append("")
    lines.append(f"describe('{component_name}', () => {{")
    lines.append(f"  it('should render without crashing', () => {{")
    lines.append(f"    render(<{component_name} />);")
    lines.append(f"    // TODO: Ajouter des assertions significatives")
    lines.append(f"    expect(document.body).toBeDefined();")
    lines.append(f"  }});")
    
    # Tests additionnels pour les exports nommés
    for exp in exports:
        if exp['type'] == 'named' and exp['name'] != component_name:
            lines.append(f"")
            lines.append(f"  it('should export {exp['name']}', () => {{")
            lines.append(f"    expect({exp['name']}).toBeDefined();")
            lines.append(f"  }});")
    
    lines.append(f"}});")
    lines.append("")
    
    return '\n'.join(lines)


def _generate_js_test(basename, exports, imports, filepath):
    """Génère un test pour un module JS/TS (hooks, utilitaires)."""
    name_no_ext = os.path.splitext(basename)[0]
    
    # Détecter si c'est un hook React
    is_hook = basename.startswith('use') or 'hook' in basename.lower()
    
    # Déterminer ce qu'on importe
    if exports:
        named_exports = [e['name'] for e in exports if e['type'] == 'named']
        default_exports = [e['name'] for e in exports if e['type'] == 'default']
        all_export_names = named_exports + default_exports
    else:
        all_export_names = [name_no_ext]
    
    export_list = ', '.join(all_export_names[:10])  # max 10
    
    lines = []
    lines.append("import { describe, it, expect, vi, beforeEach } from 'vitest';")
    
    if is_hook:
        lines.append("import { renderHook, act } from '@testing-library/react';")
    
    lines.append(f"import {{ {export_list} }} from './{name_no_ext}';")
    lines.append("")
    
    # Si c'est un hook, générer un test de hook
    if is_hook and all_export_names:
        hook_name = all_export_names[0]
        lines.append(f"describe('{hook_name}', () => {{")
        lines.append(f"  it('should return expected shape', () => {{")
        lines.append(f"    const {{ result }} = renderHook(() => {hook_name}());")
        lines.append(f"    // TODO: Ajouter des assertions sur result.current")
        lines.append(f"    expect(result.current).toBeDefined();")
        lines.append(f"  }});")
        lines.append(f"}});")
    else:
        # Tests standards pour chaque export
        lines.append(f"describe('{name_no_ext}', () => {{")
        for name in all_export_names[:10]:
            lines.append(f"  describe('{name}', () => {{")
            lines.append(f"    it('should be defined', () => {{")
            lines.append(f"      expect({name}).toBeDefined();")
            lines.append(f"    }});")
            lines.append(f"")
            lines.append(f"    it('should be a function', () => {{")
            lines.append(f"      // TODO: Vérifier le type exact (fonction, objet, classe...)")
            lines.append(f"      // expect(typeof {name}).toBe('function');")
            lines.append(f"      expect({name}).toBeDefined();")
            lines.append(f"    }});")
            lines.append(f"  }});")
            lines.append(f"")
        lines.append(f"}});")
    
    lines.append("")
    return '\n'.join(lines)


def _generate_python_test(basename, exports, imports):
    """Génère un test Python."""
    name_no_ext = os.path.splitext(basename)[0]
    
    lines = []
    lines.append(f'"""')
    lines.append(f'Tests auto-générés pour {basename}')
    lines.append(f'Généré le {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    lines.append(f'"""')
    lines.append(f'import pytest')
    lines.append(f'from {name_no_ext} import {", ".join([e["name"] for e in exports[:10]])}')
    lines.append(f'')
    
    for exp in exports[:20]:
        if exp['type'] == 'function':
            lines.append(f'')
            lines.append(f'def test_{exp["name"]}_exists():')
            lines.append(f'    """Vérifie que la fonction {exp["name"]} est importable."""')
            lines.append(f'    assert callable({exp["name"]})')
            lines.append(f'')
            lines.append(f'def test_{exp["name"]}_basic():')
            lines.append(f'    # TODO: Ajouter un vrai test')
            lines.append(f'    pass')
        elif exp['type'] == 'class':
            lines.append(f'')
            lines.append(f'def test_{exp["name"]}_exists():')
            lines.append(f'    """Vérifie que la classe {exp["name"]} est importable."""')
            lines.append(f'    assert {exp["name"]} is not None')
            lines.append(f'')
            lines.append(f'def test_{exp["name"]}_instantiate():')
            lines.append(f'    # TODO: Ajouter un vrai test avec instanciation')
            lines.append(f'    pass')
    
    lines.append(f'')
    return '\n'.join(lines)


# ---------------------------------------------------------------------------
# Batch generator
# ---------------------------------------------------------------------------

def generate_all_missing_tests(project_root, source_files, dry_run=True):
    """
    Génère des squelettes de test pour TOUS les fichiers qui n'en ont pas.
    
    Retourne: dict {filepath: test_path} des tests générés
    """
    generated = {}
    skipped = []
    
    # Fichiers à ignorer
    SKIP_PATTERNS = [
        'node_modules', '.git', 'dist', 'build', 'backups', 'documents',
        'test-results', 'playwright-report', 'coverage', '__pycache__',
        'vite.config.js', 'playwright.config.js', 'eslint.config.js',
        'setupTests.js', 'main.jsx', 'index.js', 'index.jsx',
        'capacitor.config.json', 'package.json', 'package-lock.json',
    ]
    
    for src in source_files:
        # Skip patterns
        if any(p in src for p in SKIP_PATTERNS):
            continue
        
        ext = os.path.splitext(src)[1].lower()
        if ext not in ('.js', '.jsx', '.ts', '.tsx', '.py'):
            continue
        
        # Skip fichiers de test eux-mêmes
        if '.test.' in src or '.spec.' in src or src.endswith('_test.py'):
            continue
        
        filepath = os.path.join(project_root, src)
        if not os.path.exists(filepath):
            continue
        
        test_path, content = generate_test_for_file(filepath, source_files, dry_run)
        
        if test_path:
            generated[src] = test_path
        else:
            skipped.append(src)
    
    return generated, skipped


def format_generation_report(generated, skipped, dry_run):
    """Formate un rapport de génération de tests."""
    lines = []
    lines.append("=" * 60)
    lines.append(f"  RAPPORT DE GÉNÉRATION DE TESTS — {'DRY RUN' if dry_run else 'APPLIQUÉ'}")
    lines.append("=" * 60)
    lines.append(f"")
    lines.append(f"  📝 Tests générés : {len(generated)}")
    lines.append(f"  ⏭️  Fichiers ignorés : {len(skipped)}")
    lines.append(f"")
    
    if generated:
        lines.append(f"  Fichiers de test créés :")
        for src, test in sorted(generated.items()):
            lines.append(f"    ✅ {src} → {os.path.basename(test)}")
    
    if skipped and len(skipped) <= 30:
        lines.append(f"")
        lines.append(f"  Fichiers sans test (déjà couverts ou ignorés) :")
        for s in sorted(skipped):
            lines.append(f"    ⬜ {s}")
    
    lines.append("")
    lines.append("=" * 60)
    return "\n".join(lines)

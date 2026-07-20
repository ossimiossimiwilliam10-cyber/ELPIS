"""
ELPIS Immune System — Dead Code Scanner (v1.0)
===============================================
Détecteur d'orphelins et de code mort par analyse du graphe de dépendances.

3 stratégies :
1. ORPHAN_FILES      — Fichiers jamais importés par aucun autre fichier du projet
2. UNUSED_EXPORTS    — Exports (fonctions, classes) jamais importés ailleurs
3. PHANTOM_DEPS      — Dépendances dans package.json jamais importées dans le code
"""

import os
import re
import json
from collections import defaultdict

# ---------------------------------------------------------------------------
# Strategy 1: ORPHAN FILES
# ---------------------------------------------------------------------------

def find_orphan_files(all_files_imports, source_files, project_root):
    """
    Identifie les fichiers qui ne sont importés par aucun autre fichier.
    
    all_files_imports: dict { rel_path: [imported_module_paths] }
    source_files: list de tous les chemins relatifs
    
    Retourne: liste de chemins relatifs orphelins
    """
    # Construire l'ensemble de tous les fichiers qui sont importés
    imported_files = set()
    
    for filepath, imports in all_files_imports.items():
        for imp in imports:
            resolved = _resolve_import_to_file(filepath, imp, source_files)
            if resolved:
                imported_files.add(resolved)
    
    # Un fichier est orphelin s'il n'est jamais importé
    # Exceptions: fichiers racine (main.jsx, server.js, index.html), fichiers de config
    ROOT_FILES = {
        'main.jsx', 'main.js', 'server.js', 'index.js', 'App.jsx', 'App.js',
        'vite.config.js', 'playwright.config.js', 'eslint.config.js',
        'setupTests.js', 'index.html'
    }
    
    orphans = []
    for src in source_files:
        basename = os.path.basename(src)
        
        # Skip les fichiers racine et les fichiers de config
        if basename in ROOT_FILES:
            continue
        
        # Skip les fichiers de test (ils ne sont jamais importés en production)
        if '.test.' in src or '.spec.' in src or src.endswith('_test.py'):
            continue
        
        # Skip les fichiers dans node_modules, dist, build, backups
        if any(part in src for part in ('node_modules', 'dist', 'build', 'backups', '.git')):
            continue
        
        # Normaliser pour comparaison
        norm_src = src.replace('\\', '/')
        
        # Vérifier si ce fichier est importé par quelqu'un
        is_imported = False
        for imported in imported_files:
            if imported.replace('\\', '/') == norm_src:
                is_imported = True
                break
        
        if not is_imported:
            orphans.append(src)
    
    return orphans


# ---------------------------------------------------------------------------
# Strategy 2: UNUSED EXPORTS
# ---------------------------------------------------------------------------

def find_unused_exports(filepath, lines, all_files_imports, source_files):
    """
    Pour un fichier donné, identifie les exports nommés qui ne sont jamais
    importés par aucun autre fichier.
    
    Retourne: liste de (nom_export, ligne)
    """
    exports = _extract_named_exports(filepath, lines)
    if not exports:
        return []
    
    # Trouver tous les imports depuis ce fichier
    imported_names = _find_imported_names_from(filepath, all_files_imports, source_files)
    
    unused = []
    for export_name, line_num in exports:
        if export_name not in imported_names and export_name != 'default':
            unused.append((export_name, line_num))
    
    return unused


def _extract_named_exports(filepath, lines):
    """Extrait tous les exports nommés d'un fichier JS/TS/Python."""
    exports = []
    ext = os.path.splitext(filepath)[1].lower()
    
    if ext in ('.js', '.jsx', '.ts', '.tsx'):
        # export const Name = ...
        # export function Name(
        # export { Name1, Name2 }
        for i, line in enumerate(lines):
            # export const/let/var/function/class
            match = re.search(r'export\s+(?:const|let|var|function|class)\s+(\w+)', line)
            if match:
                exports.append((match.group(1), i + 1))
                continue
            
            # export { Name1, Name2 } from ...  (re-export, on ignore)
            # export { Name1, Name2 } (sans from)
            match_brace = re.search(r'export\s*\{\s*([^}]+)\s*\}', line)
            if match_brace and 'from' not in line:
                names = [n.strip().split(' as ')[0].strip() for n in match_brace.group(1).split(',')]
                for name in names:
                    if name and name != 'default':
                        exports.append((name, i + 1))
            
            # export default function Name
            match_default = re.search(r'export\s+default\s+(?:function|class)\s+(\w+)', line)
            if match_default:
                exports.append((match_default.group(1), i + 1))
    
    elif ext == '.py':
        # Python: on considère que toutes les fonctions/classes définies sont "exportées"
        # (Python n'a pas de vrai export, tout est public par défaut)
        # On ignore __init__.py et les noms privés (_prefix)
        basename = os.path.basename(filepath)
        if basename == '__init__.py':
            return exports
        
        for i, line in enumerate(lines):
            match = re.search(r'^(?:async\s+)?def\s+(\w+)\s*\(', line)
            if match and not match.group(1).startswith('_'):
                exports.append((match.group(1), i + 1))
                continue
            match = re.search(r'^class\s+(\w+)', line)
            if match and not match.group(1).startswith('_'):
                exports.append((match.group(1), i + 1))
    
    return exports


def _find_imported_names_from(target_file, all_files_imports, source_files):
    """
    Trouve tous les noms importés depuis target_file par d'autres fichiers.
    Analyse les imports nommés: import { Name1, Name2 } from './target'
    """
    imported_names = set()
    target_norm = target_file.replace('\\', '/')
    
    for filepath, imports in all_files_imports.items():
        for imp in imports:
            resolved = _resolve_import_to_file(filepath, imp, source_files)
            if resolved and resolved.replace('\\', '/') == target_norm:
                # On a trouvé un fichier qui importe depuis target_file
                # Maintenant il faut trouver les noms spécifiques importés
                names = _extract_imported_names(filepath, imp)
                imported_names.update(names)
    
    return imported_names


def _extract_imported_names(filepath, import_path):
    """
    Extrait les noms importés depuis un import spécifique.
    Ex: import { Name1, Name2 } from './target' → {'Name1', 'Name2'}
    """
    names = set()
    ext = os.path.splitext(filepath)[1].lower()
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except (PermissionError, OSError):
        return names
    
    if ext in ('.js', '.jsx', '.ts', '.tsx'):
        # Pattern: import { Name1, Name2 } from 'path'
        # Pattern: import Name from 'path'  (default import)
        # Pattern: import * as Name from 'path'
        escaped = re.escape(import_path)
        
        # Named imports: import { Name1, Name2 } from 'path'
        named_pattern = re.compile(
            r'import\s*\{([^}]*)\}\s*from\s*[\'"]' + escaped + r'[\'"]'
        )
        for match in named_pattern.finditer(content):
            for name in match.group(1).split(','):
                name = name.strip().split(' as ')[0].strip()
                if name:
                    names.add(name)
        
        # Default import: import Name from 'path'
        default_pattern = re.compile(
            r'import\s+(\w+)\s+from\s*[\'"]' + escaped + r'[\'"]'
        )
        for match in default_pattern.finditer(content):
            names.add('default')
            names.add(match.group(1))
        
        # Namespace import: import * as Name from 'path'
        ns_pattern = re.compile(
            r'import\s*\*\s*as\s+(\w+)\s+from\s*[\'"]' + escaped + r'[\'"]'
        )
        for match in ns_pattern.finditer(content):
            names.add(match.group(1))
    
    elif ext == '.py':
        # Python: from .module import Name1, Name2
        escaped = re.escape(import_path)
        py_pattern = re.compile(
            r'from\s+' + escaped + r'\s+import\s+(.+)'
        )
        for match in py_pattern.finditer(content):
            for name in match.group(1).split(','):
                name = name.strip().split(' as ')[0].strip()
                if name and name != '*':
                    names.add(name)
    
    return names


# ---------------------------------------------------------------------------
# Strategy 3: PHANTOM DEPENDENCIES
# ---------------------------------------------------------------------------

def find_phantom_dependencies(project_root):
    """
    Compare les dépendances dans package.json avec les imports réels dans le code.
    Identifie les packages listés mais jamais importés.
    
    Retourne: liste de noms de packages fantômes
    """
    phantoms = []
    
    # Scanner les package.json dans les sous-projets
    pkg_dirs = [
        os.path.join(project_root, 'interface', 'web'),
        os.path.join(project_root, 'interface', 'bridge'),
        os.path.join(project_root),
    ]
    
    # Collecter tous les imports réels du projet
    all_imports = _collect_all_raw_imports(project_root)
    
    for pkg_dir in pkg_dirs:
        pkg_path = os.path.join(pkg_dir, 'package.json')
        if not os.path.exists(pkg_path):
            continue
        
        try:
            with open(pkg_path, 'r', encoding='utf-8') as f:
                pkg = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        
        # Vérifier les dépendances
        for dep_type in ('dependencies', 'devDependencies'):
            deps = pkg.get(dep_type, {})
            for dep_name in deps:
                # Skip les packages qui sont des outils (pas importés directement)
                if _is_tool_dependency(dep_name):
                    continue
                
                # Vérifier si ce package est importé quelque part
                is_used = _is_package_imported(dep_name, all_imports)
                
                if not is_used:
                    phantoms.append({
                        'package': dep_name,
                        'type': dep_type,
                        'package_json': os.path.relpath(pkg_path, project_root),
                    })
    
    return phantoms


def _collect_all_raw_imports(project_root):
    """Collecte tous les imports bruts depuis tous les fichiers source."""
    all_imports = set()
    
    for root, dirs, files in os.walk(project_root):
        dirs[:] = [d for d in dirs if d not in {
            'node_modules', '.git', 'dist', 'build', 'backups',
            '__pycache__', '.venv', 'documents'
        }]
        
        for filename in files:
            ext = os.path.splitext(filename)[1].lower()
            if ext not in ('.js', '.jsx', '.ts', '.tsx', '.py'):
                continue
            
            filepath = os.path.join(root, filename)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
            except (PermissionError, OSError):
                continue
            
            # Extraire les imports
            if ext in ('.js', '.jsx', '.ts', '.tsx'):
                # import X from 'package'
                for match in re.finditer(r"""import\s+(?:[\w*\s{},]*)\s*from\s*['"]([^'"]+)['"]""", content):
                    pkg = match.group(1)
                    if not pkg.startswith('.') and not pkg.startswith('/') and not pkg.startswith('node:'):
                        # Prendre le nom de base du package (avant /)
                        base_pkg = pkg.split('/')[0]
                        if base_pkg.startswith('@'):
                            # Scoped package: @scope/name
                            parts = pkg.split('/')
                            if len(parts) >= 2:
                                base_pkg = f"{parts[0]}/{parts[1]}"
                        all_imports.add(base_pkg)
                
                # require('package')
                for match in re.finditer(r"""require\s*\(\s*['"]([^'"]+)['"]\s*\)""", content):
                    pkg = match.group(1)
                    if not pkg.startswith('.') and not pkg.startswith('/') and not pkg.startswith('node:'):
                        base_pkg = pkg.split('/')[0]
                        if base_pkg.startswith('@'):
                            parts = pkg.split('/')
                            if len(parts) >= 2:
                                base_pkg = f"{parts[0]}/{parts[1]}"
                        all_imports.add(base_pkg)
            
            elif ext == '.py':
                for match in re.finditer(r"""^(?:import\s+(\S+)|from\s+(\S+)\s+import)""", content, re.MULTILINE):
                    pkg = match.group(1) or match.group(2)
                    if pkg and not pkg.startswith('.'):
                        base_pkg = pkg.split('.')[0]
                        all_imports.add(base_pkg)
    
    return all_imports


def _is_tool_dependency(pkg_name):
    """Vérifie si un package est un outil de build/test (pas importé directement)."""
    TOOLS = {
        'vite', 'vitest', 'eslint', 'prettier', 'typescript', 'ts-node',
        '@vitejs/plugin-react', '@vitest/coverage-v8', '@playwright/test',
        '@testing-library/react', '@testing-library/jest-dom', 'jsdom',
        'fake-indexeddb', 'workbox-build', 'vite-plugin-pwa',
        '@capacitor/cli', '@capacitor/android', '@capacitor/core',
        'globals', '@eslint/js', 'eslint-plugin-react-hooks',
        'eslint-plugin-react-refresh', '@types/react', '@types/react-dom',
        'nodemon', 'concurrently', 'cross-env', 'dotenv',
    }
    return pkg_name in TOOLS


def _is_package_imported(pkg_name, all_imports):
    """Vérifie si un package est importé dans le code."""
    return pkg_name in all_imports


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_import_to_file(current_file, import_path, source_files):
    """Résout un import relatif en chemin de fichier absolu."""
    current_dir = os.path.dirname(current_file)
    resolved = os.path.normpath(os.path.join(current_dir, import_path))
    
    # Chercher avec différentes extensions
    for ext in ['', '.js', '.jsx', '.ts', '.tsx', '.py', '/index.js', '/index.jsx', '/index.ts']:
        candidate = resolved + ext
        candidate_norm = candidate.replace('\\', '/')
        for f in source_files:
            if f.replace('\\', '/') == candidate_norm:
                return f
    return None


# ---------------------------------------------------------------------------
# Scanner unifié
# ---------------------------------------------------------------------------

def scan_dead_code(project_root, source_files, all_files_imports):
    """
    Point d'entrée principal. Exécute les 3 stratégies et retourne
    un dictionnaire structuré des résultats.
    """
    results = {
        'orphan_files': [],
        'unused_exports': [],
        'phantom_dependencies': [],
    }
    
    # 1. Fichiers orphelins
    results['orphan_files'] = find_orphan_files(all_files_imports, source_files, project_root)
    
    # 2. Exports inutilisés (échantillon — fichiers .js/.jsx/.py dans web/src et bridge/)
    focus_dirs = [
        os.path.join(project_root, 'interface', 'web', 'src'),
        os.path.join(project_root, 'interface', 'bridge'),
        os.path.join(project_root, 'agent_audit'),
    ]
    
    for focus_dir in focus_dirs:
        if not os.path.exists(focus_dir):
            continue
        for filepath in source_files:
            full_path = os.path.join(project_root, filepath)
            if not full_path.startswith(focus_dir):
                continue
            
            ext = os.path.splitext(filepath)[1].lower()
            if ext not in ('.js', '.jsx', '.py'):
                continue
            
            try:
                with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()
            except (PermissionError, OSError):
                continue
            
            unused = find_unused_exports(full_path, lines, all_files_imports, source_files)
            for name, line_num in unused:
                results['unused_exports'].append({
                    'file': filepath,
                    'export_name': name,
                    'line': line_num,
                })
    
    # 3. Dépendances fantômes
    results['phantom_dependencies'] = find_phantom_dependencies(project_root)
    
    return results


def format_dead_code_report(results):
    """Formate les résultats en un rapport lisible."""
    lines = []
    lines.append("=" * 60)
    lines.append("  RAPPORT DE CODE MORT — Agent Audit v4.0")
    lines.append("=" * 60)
    
    # Fichiers orphelins
    lines.append(f"\n📁 FICHIERS ORPHELINS ({len(results['orphan_files'])} trouvés)")
    lines.append("-" * 40)
    if results['orphan_files']:
        for f in sorted(results['orphan_files']):
            lines.append(f"  🔴 {f}")
    else:
        lines.append("  ✅ Aucun fichier orphelin détecté.")
    
    # Exports inutilisés
    lines.append(f"\n📤 EXPORTS INUTILISÉS ({len(results['unused_exports'])} trouvés)")
    lines.append("-" * 40)
    if results['unused_exports']:
        # Grouper par fichier
        by_file = defaultdict(list)
        for item in results['unused_exports']:
            by_file[item['file']].append((item['export_name'], item['line']))
        for f, exports in sorted(by_file.items()):
            lines.append(f"  📄 {f}")
            for name, line_num in exports[:10]:  # Limiter à 10 par fichier
                lines.append(f"     L{line_num}: export {name}")
            if len(exports) > 10:
                lines.append(f"     ... et {len(exports) - 10} autres")
    else:
        lines.append("  ✅ Aucun export inutilisé détecté.")
    
    # Dépendances fantômes
    lines.append(f"\n📦 DÉPENDANCES FANTÔMES ({len(results['phantom_dependencies'])} trouvées)")
    lines.append("-" * 40)
    if results['phantom_dependencies']:
        for dep in results['phantom_dependencies']:
            lines.append(f"  🟡 {dep['package']} ({dep['type']}) — {dep['package_json']}")
    else:
        lines.append("  ✅ Aucune dépendance fantôme détectée.")
    
    lines.append("\n" + "=" * 60)
    return "\n".join(lines)

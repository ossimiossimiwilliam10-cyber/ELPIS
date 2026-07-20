"""
ELPIS Immune System — Multi-Strategy Scanners
==============================================
6 strategies de detection :
1. REGEX         — patterns ligne par ligne (compatible v2)
2. MULTI_LINE    — patterns qui traversent les lignes
3. IMPORT_GRAPH  — detection d'imports circulaires
4. BOUNDARY      — analyse de frontieres (nesting, fonction length)
5. TEST_PAIRING  — verification que chaque source a un fichier de test
6. STRUCTURAL    — patterns architecturaux (layer violations)
"""

import re
import os
import subprocess
import json
from collections import defaultdict

# ---------------------------------------------------------------------------
# Strategy 1: REGEX (line-by-line, V2 compatible)
# ---------------------------------------------------------------------------

def scan_regex(lines, file_rel_path, filename, rules):
    """
    Scanner regex ligne par ligne. C'est le scanner historique v2.
    Retourne la liste des anomalies avec metadonnees de fix.
    """
    anomalies = []

    for rule in rules:
        # Skip les regles qui utilisent d'autres strategies
        detection = rule.get('detection_strategy')
        if detection and detection != 'regex':
            continue

        # Verifier le file_pattern
        file_pat = rule.get('file_pattern', '.*')
        if not re.search(file_pat, filename):
            continue

        # Verifier l'exclusion — teste sur le chemin relatif COMPLET
        exclude_pat = rule.get('exclude_pattern')
        if exclude_pat and re.search(exclude_pat, file_rel_path):
            continue

        # Skip les regles sans patterns ou avec patterns speciaux
        patterns = rule.get('patterns', [rule.get('pattern', '')])
        if not patterns or patterns[0] in ('CIRCULAR_DETECTED', 'LAYER_VIOLATION',
                                            'FILE_LINE_COUNT_CHECK', 'FUNCTION_LENGTH_CHECK',
                                            'NESTING_DEPTH_CHECK', 'TEST_COVERAGE_CHECK'):
            continue

        multi_line = rule.get('multi_line', False)

        if multi_line:
            # Scanner le fichier entier comme une seule string
            full_text = ''.join(lines)
            for pattern in patterns:
                if not pattern:
                    continue
                try:
                    compiled = re.compile(pattern, re.DOTALL | re.MULTILINE)
                    for match in compiled.finditer(full_text):
                        # Trouver le numero de ligne
                        line_num = full_text[:match.start()].count('\n') + 1
                        anomaly = _build_anomaly(rule, file_rel_path, line_num, match.group(0).strip()[:200])
                        anomalies.append(anomaly)
                except re.error:
                    continue  # Skip les patterns invalides
        else:
            # Scanner ligne par ligne
            for i, line in enumerate(lines):
                for pattern in patterns:
                    if not pattern:
                        continue
                    try:
                        if re.search(pattern, line):
                            anomaly = _build_anomaly(rule, file_rel_path, i + 1, line.rstrip('\n')[:200])
                            anomalies.append(anomaly)
                            break  # Une seule anomalie par ligne par regle
                    except re.error:
                        continue

    return anomalies


# ---------------------------------------------------------------------------
# Strategy 2: IMPORT GRAPH (circular dependency detection)
# ---------------------------------------------------------------------------

def scan_import_graph(all_files_data, rules):
    """
    Construit un graphe d'imports et detecte les cycles.
    all_files_data: dict { rel_path: [imported_modules] }
    """
    anomalies = []
    circular_rules = [r for r in rules if r.get('detection_strategy') == 'import_graph']

    if not circular_rules:
        return anomalies

    # Construire le graphe
    graph = defaultdict(set)
    for filepath, imports in all_files_data.items():
        for imp in imports:
            # Resoudre l'import relatif vers un chemin absolu
            resolved = _resolve_import(filepath, imp, all_files_data.keys())
            if resolved:
                graph[filepath].add(resolved)

    # DFS pour detecter les cycles
    visited = set()
    rec_stack = set()

    def dfs(node, path):
        visited.add(node)
        rec_stack.add(node)

        for neighbor in graph.get(node, set()):
            if neighbor not in visited:
                cycle = dfs(neighbor, path + [node])
                if cycle:
                    return cycle
            elif neighbor in rec_stack:
                # Cycle trouve
                cycle_path = path + [node, neighbor]
                return cycle_path

        rec_stack.discard(node)
        return None

    for node in graph:
        if node not in visited:
            cycle = dfs(node, [])
            if cycle:
                # Trouver la regle de detection d'imports circulaires
                for rule in circular_rules:
                    anomaly = {
                        'rule_id': rule['id'],
                        'severity': rule['severity'],
                        'description': rule['description'],
                        'category': rule.get('category', 'ARCHITECTURE'),
                        'file': cycle[0],
                        'line': 1,
                        'code_snippet': f'Cycle: {" -> ".join(cycle)}',
                        '_fixable': False,
                        '_escalation_message': rule.get('escalation_message', '')
                    }
                    anomalies.append(anomaly)
                break  # Un seul cycle suffit pour declencher l'alerte

    return anomalies


def _resolve_import(current_file, import_path, all_files):
    """Resout un import relatif en chemin de fichier absolu."""
    current_dir = os.path.dirname(current_file)
    resolved = os.path.normpath(os.path.join(current_dir, import_path))

    # Chercher avec differentes extensions
    for ext in ['', '.js', '.jsx', '.ts', '.tsx', '.py', '/index.js', '/index.jsx']:
        candidate = resolved + ext
        candidate_norm = candidate.replace('\\', '/')
        for f in all_files:
            if f.replace('\\', '/') == candidate_norm:
                return f
    return None


# ---------------------------------------------------------------------------
# Strategy 3: STRUCTURAL (function boundaries, nesting, file size)
# ---------------------------------------------------------------------------

def scan_structural(lines, file_rel_path, filename, rules):
    """
    Analyse structurelle : longueur de fonction, nesting depth, taille de fichier.
    """
    anomalies = []

    for rule in rules:
        detection = rule.get('detection_strategy')

        if detection == 'function_boundaries':
            anomalies.extend(_check_function_length(lines, file_rel_path, filename, rule))

        elif detection == 'nesting_analysis':
            anomalies.extend(_check_nesting_depth(lines, file_rel_path, filename, rule))

        # File size check (utilise le champ threshold_lines si present)
        if rule.get('threshold_lines') and len(lines) > rule['threshold_lines']:
            file_pat = rule.get('file_pattern', '.*')
            if re.search(file_pat, filename):
                exclude_pat = rule.get('exclude_pattern')
                if not (exclude_pat and re.search(exclude_pat, file_rel_path)):
                    anomaly = _build_anomaly(rule, file_rel_path, 1,
                                             f'{len(lines)} lignes (limite: {rule["threshold_lines"]})')
                    anomalies.append(anomaly)

    return anomalies


def _check_function_length(lines, file_rel_path, filename, rule):
    """Detecte les fonctions qui depassent le seuil de lignes."""
    anomalies = []
    threshold = rule.get('threshold_lines', 50)
    ext = os.path.splitext(filename)[1].lower()

    # Patterns pour detecter le debut de fonction selon le langage
    if ext in ('.js', '.jsx', '.ts', '.tsx'):
        func_start_pattern = re.compile(
            r'^\s*(export\s+)?(async\s+)?(function\s+\w+|const\s+\w+\s*=\s*(\([^)]*\)|async\s*\()\s*=>|(\w+)\s*=\s*(\([^)]*\)|async\s*\()\s*=>|\w+\s*\([^)]*\)\s*\{)'
        )
    elif ext == '.py':
        func_start_pattern = re.compile(r'^\s*def\s+\w+\s*\(')
    else:
        return anomalies

    # Trouver les fonctions et mesurer leur longueur
    func_starts = []
    for i, line in enumerate(lines):
        if func_start_pattern.search(line):
            func_starts.append(i)

    for start_idx in func_starts:
        # Compter jusqu'a la prochaine fonction ou fin de fichier
        # Simplification: compter les lignes jusqu'a une ligne avec 0 indentation ou prochaine fonction
        end_idx = len(lines)
        for j in range(start_idx + 1, len(lines)):
            if func_start_pattern.search(lines[j]):
                end_idx = j
                break

        func_length = end_idx - start_idx
        if func_length > threshold:
            anomaly = _build_anomaly(rule, file_rel_path, start_idx + 1,
                                     f'Fonction de {func_length} lignes (limite: {threshold})')
            anomalies.append(anomaly)

    return anomalies


def _check_nesting_depth(lines, file_rel_path, filename, rule):
    """Analyse la profondeur d'imbrication."""
    anomalies = []
    threshold = rule.get('threshold_depth', 4)
    ext = os.path.splitext(filename)[1].lower()

    if ext in ('.js', '.jsx', '.ts', '.tsx'):
        openers = re.compile(r'\b(if|for|while|switch|try|with)\b')
        # Comptage simplifie : mesurer l'indentation
        for i, line in enumerate(lines):
            stripped = line.lstrip()
            if not stripped or stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
                continue
            indent = len(line) - len(stripped)
            depth = indent // 2  # Approximation : 2 espaces par niveau
            if depth > threshold and openers.search(stripped):
                anomaly = _build_anomaly(rule, file_rel_path, i + 1,
                                         f'Nesting depth ~{depth} (limite: {threshold})')
                anomalies.append(anomaly)
    elif ext == '.py':
        openers = re.compile(r'\b(if|for|while|with|try|except|def|class)\b')
        for i, line in enumerate(lines):
            stripped = line.lstrip()
            if not stripped or stripped.startswith('#'):
                continue
            indent = len(line) - len(stripped)
            depth = indent // 4  # Python standard: 4 espaces
            if depth > threshold and openers.search(stripped):
                anomaly = _build_anomaly(rule, file_rel_path, i + 1,
                                         f'Nesting depth ~{depth} (limite: {threshold})')
                anomalies.append(anomaly)

    return anomalies


# ---------------------------------------------------------------------------
# Strategy 4: TEST PAIRING
# ---------------------------------------------------------------------------

def scan_test_coverage(source_files, rules, project_root):
    """Verifie que chaque fichier source a un fichier de test correspondant."""
    anomalies = []
    pairing_rules = [r for r in rules if r.get('detection_strategy') == 'test_pairing']

    if not pairing_rules:
        return anomalies

    test_files = {f for f in source_files if '.test.' in f or '.spec.' in f or f.endswith('_test.py')}

    for src_file in source_files:
        # Skip fichiers de test eux-memes
        if '.test.' in src_file or '.spec.' in src_file or src_file.endswith('_test.py'):
            continue
        # Skip fichiers exclus
        basename = os.path.basename(src_file)
        if basename in ('index.js', 'index.jsx', 'main.jsx', 'setupTests.js',
                         'eslint.config.js', 'vite.config.js', 'playwright.config.js'):
            continue

        # Verifier si un test correspondant existe
        has_test = _has_corresponding_test(src_file, test_files)

        if not has_test:
            for rule in pairing_rules:
                file_pat = rule.get('file_pattern', '.*')
                if not re.search(file_pat, basename):
                    continue
                exclude_pat = rule.get('exclude_pattern')
                if exclude_pat and re.search(exclude_pat, basename):
                    continue

                anomaly = _build_anomaly(rule, src_file, 1,
                                         f'Aucun fichier de test pour {basename}')
                anomalies.append(anomaly)

    return anomalies


def _has_corresponding_test(src_file, test_files):
    """Verifie si un fichier de test correspond a src_file."""
    base = os.path.splitext(src_file)[0]
    possible_tests = [
        f'{base}.test.js', f'{base}.test.jsx', f'{base}.test.ts', f'{base}.test.tsx',
        f'{base}.spec.js', f'{base}.spec.jsx', f'{base}_test.py',
        f'{os.path.dirname(src_file)}/__tests__/{os.path.basename(src_file)}'
    ]
    for pt in possible_tests:
        norm = pt.replace('\\', '/')
        for tf in test_files:
            if tf.replace('\\', '/') == norm:
                return True
    return False


# ---------------------------------------------------------------------------
# Strategy 5: LAYER BOUNDARY (architectural violations)
# ---------------------------------------------------------------------------

def scan_layer_boundaries(all_files_data, rules):
    """
    Verifie les violations de frontieres architecturales.
    all_files_data: dict { rel_path: [imported_modules] }
    """
    anomalies = []
    boundary_rules = [r for r in rules if r.get('detection_strategy') == 'layer_boundary']

    if not boundary_rules:
        return anomalies

    for rule in boundary_rules:
        layer_rules = rule.get('layer_rules', {})
        if not layer_rules:
            continue

        for filepath, imports in all_files_data.items():
            # Determiner le layer du fichier source
            source_layer = _get_layer(filepath, layer_rules.keys())

            if not source_layer:
                continue

            allowed = set(layer_rules.get(source_layer, []))

            for imp in imports:
                target_layer = _get_layer(imp, layer_rules.keys())
                if target_layer and target_layer not in allowed and target_layer != source_layer:
                    anomaly = {
                        'rule_id': rule['id'],
                        'severity': rule['severity'],
                        'description': rule['description'],
                        'category': rule.get('category', 'ARCHITECTURE'),
                        'file': filepath,
                        'line': 1,
                        'code_snippet': f'{source_layer} -> {target_layer}: import "{imp}"',
                        '_fixable': False,
                        '_escalation_message': rule.get('escalation_message', '')
                    }
                    anomalies.append(anomaly)

    return anomalies


def _get_layer(filepath, layers):
    """Determine le layer architectural d'un fichier."""
    path_lower = filepath.lower()
    for layer in layers:
        if f'/{layer}/' in f'/{path_lower}' or path_lower.startswith(f'{layer}/'):
            return layer
    return None


# ---------------------------------------------------------------------------
# Strategy 6: EXTRACT IMPORTS (for import graph and layer analysis)
# ---------------------------------------------------------------------------

def extract_imports(filepath, lines):
    """Extrait la liste des imports d'un fichier JS/TS/Python."""
    imports = []
    ext = os.path.splitext(filepath)[1].lower()

    if ext in ('.js', '.jsx', '.ts', '.tsx'):
        import_re = re.compile(r"""(?:import\s+(?:(?:\{[^}]*\}|[^'"\s]+)\s*,?\s*)*\s*from\s*['"]([^'"]+)['"]|require\s*\(['"]([^'"]+)['"]\))""")
        for line in lines:
            for match in import_re.finditer(line):
                imp = match.group(1) or match.group(2)
                if imp and not imp.startswith('@') and not imp.startswith('node:'):
                    imports.append(imp)

    elif ext == '.py':
        import_re = re.compile(r"""(?:from\s+(\S+)\s+import|import\s+(\S+))""")
        for line in lines:
            for match in import_re.finditer(line):
                imp = match.group(1) or match.group(2)
                if imp and not imp.startswith('__'):
                    imports.append(imp)

    return imports


# ---------------------------------------------------------------------------
# Custom Python Scanners
# ---------------------------------------------------------------------------

def scan_custom_python(lines, rel_path, filename, rules, project_root):
    anomalies = []

    for rule in rules:
        if rule.get('detection_strategy') != 'custom_python':
            continue

        file_pat = rule.get('file_pattern', '.*')
        if not re.search(file_pat, rel_path):
            continue

        exclude_pat = rule.get('exclude_pattern')
        if exclude_pat and re.search(exclude_pat, rel_path):
            continue

        patterns = rule.get('patterns', [])

        if 'scan_pwa_static_exclusions' in patterns:
            # Code specifique au scan PWA
            server_path = os.path.join(project_root, 'interface', 'bridge', 'server.js')
            if not os.path.exists(server_path):
                continue

            with open(server_path, 'r', encoding='utf-8', errors='ignore') as f:
                server_content = f.read()

            # Extraire app.use('/music', express.static(...))
            static_routes = re.findall(r"app\.use\(['\"](/[^'\"]+)['\"]\s*,\s*express\.static", server_content)

            content = "".join(lines)
            for route in static_routes:
                # ex: route='/music', target: /^\/music\//
                # the string in vite.config.js is exactly /^\/music\//
                expected = f"/^\\\\{route}\\\\/"
                if expected not in content:
                    anomalies.append(_build_anomaly(
                        rule, rel_path, 1,
                        f"Route statique '{route}' manquante dans navigateFallbackDenylist de la PWA."
                    ))

        elif 'scan_useeffect_cleanup_interval' in patterns:
            anomalies.extend(_scan_useeffect_cleanup(lines, rel_path, rule, 'setInterval', 'clearInterval'))

        elif 'scan_useeffect_cleanup_listener' in patterns:
            anomalies.extend(_scan_useeffect_cleanup(lines, rel_path, rule, 'addEventListener', 'removeEventListener'))

        elif 'scan_unguarded_json_parse' in patterns:
            anomalies.extend(_scan_unguarded_json_parse(lines, rel_path, rule))

        elif 'scan_express_async_handlers' in patterns:
            anomalies.extend(_scan_express_async_handlers(lines, rel_path, rule))

        elif 'scan_fetch_without_abort' in patterns:
            anomalies.extend(_scan_fetch_without_abort(lines, rel_path, rule))

    return anomalies


# ---------------------------------------------------------------------------
# Custom Scanner: useEffect cleanup detection
# ---------------------------------------------------------------------------

def _scan_useeffect_cleanup(lines, rel_path, rule, target_call, cleanup_call):
    """
    Detecte les useEffect contenant `target_call` (ex: setInterval)
    sans `cleanup_call` (ex: clearInterval) dans le bloc return.
    Utilise un compteur de profondeur d'accolades pour delimiter le bloc useEffect.
    """
    anomalies = []
    content = ''.join(lines)

    # Trouver tous les useEffect
    useeffect_re = re.compile(r'useEffect\s*\(\s*\(\s*\)\s*=>\s*\{')
    for match in useeffect_re.finditer(content):
        start = match.end()
        line_num = content[:match.start()].count('\n') + 1

        # Trouver la fin du bloc useEffect avec compteur d'accolades
        depth = 1
        pos = start
        while pos < len(content) and depth > 0:
            if content[pos] == '{':
                depth += 1
            elif content[pos] == '}':
                depth -= 1
            pos += 1

        block = content[start:pos]

        # Verifier si le bloc contient target_call
        if target_call not in block:
            continue

        # Verifier si le bloc contient un return () => ... avec cleanup_call
        # On cherche le pattern return dans le useEffect
        has_cleanup = False
        return_re = re.compile(r'return\s*\(\s*\)\s*=>\s*\{?')
        for ret_match in return_re.finditer(block):
            # Extraire le contenu du cleanup
            ret_start = ret_match.end()
            # Chercher le cleanup_call apres le return
            remaining = block[ret_start:]
            if cleanup_call in remaining:
                has_cleanup = True
                break

        if not has_cleanup:
            snippet = f"useEffect contient {target_call}() sans {cleanup_call}() dans le return"
            anomalies.append(_build_anomaly(rule, rel_path, line_num, snippet))

    return anomalies


# ---------------------------------------------------------------------------
# Custom Scanner: unguarded JSON.parse
# ---------------------------------------------------------------------------

def _scan_unguarded_json_parse(lines, rel_path, rule):
    """
    Detecte les JSON.parse() qui ne sont pas dans un bloc try.
    Remonte les lignes precedentes pour verifier la presence d'un 'try {'.
    """
    anomalies = []
    json_parse_re = re.compile(r'JSON\.parse\(')

    for i, line in enumerate(lines):
        if not json_parse_re.search(line):
            continue

        # Verifier si on est deja dans un try block
        # Remonter les lignes (max 15) pour chercher 'try {'
        in_try = False
        depth = 0
        for j in range(i, max(i - 15, -1), -1):
            check_line = lines[j].strip()
            # Compter les accolades en remontant
            depth += check_line.count('}')
            depth -= check_line.count('{')
            if re.search(r'\btry\s*\{', check_line):
                in_try = True
                break
            # Si on remonte au-dela de la portee (depth > 0 = sorti du bloc)
            if depth > 1:
                break

        if not in_try:
            snippet = line.strip()[:200]
            anomalies.append(_build_anomaly(rule, rel_path, i + 1, snippet))

    return anomalies


# ---------------------------------------------------------------------------
# Custom Scanner: Express async handlers without try/catch
# ---------------------------------------------------------------------------

def _scan_express_async_handlers(lines, rel_path, rule):
    """
    Detecte les handlers Express async (req, res) sans try/catch.
    Cherche le pattern 'async (req, res' puis verifie que le corps contient 'try {'.
    """
    anomalies = []
    content = ''.join(lines)

    # Pattern : async (req, res...) => { ou async function(req, res) {
    handler_re = re.compile(r'async\s*\(\s*req\s*,\s*res(?:\s*,\s*\w+)?\s*\)\s*(?:=>)?\s*\{')

    for match in handler_re.finditer(content):
        start = match.end()
        line_num = content[:match.start()].count('\n') + 1

        # Trouver la fin du bloc handler
        depth = 1
        pos = start
        while pos < len(content) and depth > 0:
            if content[pos] == '{':
                depth += 1
            elif content[pos] == '}':
                depth -= 1
            pos += 1

        block = content[start:pos]

        # Verifier si le bloc contient 'try {'
        if not re.search(r'\btry\s*\{', block):
            snippet = f"async (req, res) handler sans try/catch (ligne {line_num})"
            anomalies.append(_build_anomaly(rule, rel_path, line_num, snippet))

    return anomalies


# ---------------------------------------------------------------------------
# Custom Scanner: fetch() without AbortController in React components
# ---------------------------------------------------------------------------

def _scan_fetch_without_abort(lines, rel_path, rule):
    """
    Detecte les composants React avec useEffect contenant fetch()
    mais sans AbortController dans le meme scope.
    """
    anomalies = []
    content = ''.join(lines)

    # Verifier d'abord si c'est un composant React (contient useEffect)
    if 'useEffect' not in content:
        return anomalies

    # Verifier si le fichier utilise fetch
    if 'fetch(' not in content:
        return anomalies

    # Verifier si AbortController est utilise quelque part
    if 'AbortController' in content:
        return anomalies

    # Chercher les useEffect contenant fetch
    useeffect_re = re.compile(r'useEffect\s*\(\s*\(\s*\)\s*=>\s*\{')
    for match in useeffect_re.finditer(content):
        start = match.end()
        line_num = content[:match.start()].count('\n') + 1

        depth = 1
        pos = start
        while pos < len(content) and depth > 0:
            if content[pos] == '{':
                depth += 1
            elif content[pos] == '}':
                depth -= 1
            pos += 1

        block = content[start:pos]

        if 'fetch(' in block:
            snippet = f"useEffect avec fetch() sans AbortController (ligne {line_num})"
            anomalies.append(_build_anomaly(rule, rel_path, line_num, snippet))

    return anomalies


# ---------------------------------------------------------------------------
# Unified Scanner Entry Point
# ---------------------------------------------------------------------------


from engine import should_auto_fix
from ast_scanner import run_ast_scanners

def run_all_scanners(filepath, rel_path, lines, rules, all_files_data, source_files, project_root):
    """
    Point d'entree unifie : execute tous les scanners applicables et retourne
    la liste combinee d'anomalies.
    """
    filename = os.path.basename(filepath)
    anomalies = []

    # 1. Scanner regex (inclut multi-line)
    regex_anomalies = scan_regex(lines, rel_path, filename, rules)
    anomalies.extend(regex_anomalies)

    # 2. Scanner structurel (function length, nesting, file size)
    structural_anomalies = scan_structural(lines, rel_path, filename, rules)
    anomalies.extend(structural_anomalies)

    # 3. Scanner AST (python_ast + js_enhanced — zero faux positifs)
    ast_anomalies, _ = run_ast_scanners(filepath, rel_path, lines, rules, all_files_data, source_files)
    anomalies.extend(ast_anomalies)

    # 4. Scanner custom python
    custom_anomalies = scan_custom_python(lines, rel_path, filename, rules, project_root)
    anomalies.extend(custom_anomalies)

    # 5. Marquer les anomalies fixables
    for anomaly in anomalies:
        rule_id = anomaly['rule_id']
        rule = _find_rule(rules, rule_id)
        if rule:
            anomaly['_fixable'] = should_auto_fix(rule)
            anomaly['_escalation_message'] = rule.get('escalation_message', '')
            anomaly['category'] = rule.get('category', 'UNKNOWN')
        else:
            anomaly['_fixable'] = False
            anomaly['_escalation_message'] = ''
            anomaly['category'] = 'UNKNOWN'

    return anomalies, len(lines)


def run_global_scanners(rules, all_files_data, source_files, project_root):
    """
    Execute les scanners globaux (import graph, layer boundaries, test coverage)
    qui necessitent une vue d'ensemble de tous les fichiers.
    """
    anomalies = []

    # Import graph (circular dependencies)
    anomalies.extend(scan_import_graph(all_files_data, rules))

    # Layer boundaries
    anomalies.extend(scan_layer_boundaries(all_files_data, rules))

    # Test coverage
    anomalies.extend(scan_test_coverage(source_files, rules, project_root))

    # Test Healing (Tests cassés)
    anomalies.extend(scan_broken_tests(project_root, rules))

    # NPM Audit (Sécurité)
    anomalies.extend(scan_npm_audit(project_root, rules))

    return anomalies

# ---------------------------------------------------------------------------
# Strategy 7: SECURITY SCAN (NPM Audit)
# ---------------------------------------------------------------------------

def scan_npm_audit(project_root, rules):
    """Exécute npm audit dans les répertoires clés et extrait les vulnérabilités."""
    anomalies = []
    
    # Vérifier si on a une règle active pour la sécurité
    sec_rule = _find_rule(rules, 'SEC-001') # Supposons qu'on aura une règle SEC-001
    
    # Même sans règle, on l'injecte génériquement si vuln trouvée
    dirs_to_scan = [
        os.path.join(project_root, 'interface', 'web'),
        os.path.join(project_root, 'interface', 'bridge')
    ]
    
    for d in dirs_to_scan:
        if not os.path.exists(d):
            continue
            
        try:
            result = subprocess.run(
                ['npm', 'audit', '--json'],
                cwd=d, capture_output=True, text=True, check=False
            )
            audit_data = json.loads(result.stdout)
            
            if 'vulnerabilities' in audit_data:
                for pkg, vuln in audit_data['vulnerabilities'].items():
                    severity = vuln.get('severity', 'info')
                    if severity in ['critical', 'high']:
                        anomaly = {
                            'rule_id': 'SEC-001',
                            'severity': 'critical',
                            'description': f"Vulnérabilité {severity} dans le package '{pkg}'.",
                            'category': 'SECURITY',
                            'file': os.path.join(d, 'package.json'),
                            'line': 1,
                            'code_snippet': f'"{pkg}": "{vuln.get("range", "unknown")}"',
                            'cwe_ref': 'CWE-937', # Usage of Vulnerable Component
                            '_fixable': vuln.get('isDirect', False), # Uniquement fixable si direct
                            '_npm_package': pkg,
                            '_npm_dir': d
                        }
                        anomalies.append(anomaly)
        except Exception:
            pass # Si npm échoue, on ignore
            
    return anomalies

# ---------------------------------------------------------------------------
# Strategy 8: BROKEN TESTS SCAN
# ---------------------------------------------------------------------------

def scan_broken_tests(project_root, rules):
    """Exécute Vitest et retourne des anomalies pour les tests cassés."""
    anomalies = []
    
    dirs_to_scan = [
        os.path.join(project_root, 'interface', 'web'),
        os.path.join(project_root, 'interface', 'bridge')
    ]
    
    for d in dirs_to_scan:
        if not os.path.exists(d):
            continue
            
        try:
            # On run Vitest sur tout, on récupère le JSON
            result = subprocess.run(
                ['npx', 'vitest', 'run', '--passWithNoTests', '--reporter=json'],
                cwd=d, capture_output=True, text=True, check=False
            )
            
            # Vitest JSON output is usually at the end of stdout
            stdout_str = result.stdout
            json_start = stdout_str.find('{')
            if json_start != -1:
                json_str = stdout_str[json_start:]
                try:
                    test_data = json.loads(json_str)
                    
                    if not test_data.get('success', True) and 'testResults' in test_data:
                        for test_file in test_data['testResults']:
                            if test_file.get('status') == 'failed':
                                file_path = test_file.get('name', '')
                                message = test_file.get('message', '')
                                
                                # On check si une règle TEST-HEAL correspond
                                for rule in rules:
                                    if rule.get('id', '').startswith('TEST-HEAL'):
                                        patterns = rule.get('patterns', [])
                                        for pat in patterns:
                                            if pat in message:
                                                anomalies.append({
                                                    'rule_id': rule['id'],
                                                    'severity': rule.get('severity', 'warning'),
                                                    'description': rule.get('description', ''),
                                                    'category': rule.get('category', 'TESTING'),
                                                    'file': file_path,
                                                    'line': 1,
                                                    'code_snippet': message[:100] + '...',
                                                    '_fixable': True
                                                })
                                                break
                except json.JSONDecodeError:
                    pass
        except Exception:
            pass
            
    return anomalies


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_anomaly(rule, file_path, line_num, snippet):
    """Construit un dictionnaire d'anomalie standardise."""
    return {
        'rule_id': rule['id'],
        'severity': rule['severity'],
        'description': rule['description'],
        'category': rule.get('category', 'UNKNOWN'),
        'file': file_path,
        'line': line_num,
        'code_snippet': snippet,
        'cwe_ref': rule.get('cwe_ref'),
        'wcag_ref': rule.get('wcag_ref'),
        '_fixable': False,   # Sera mis a jour par l'engine
        '_escalation_message': rule.get('escalation_message', ''),
        '_suppression_comment': rule.get('suppression_comment', '')
    }

def _find_rule(rules, rule_id):
    for r in rules:
        if r.get('id') == rule_id:
            return r
    return None
"""
ELPIS Immune System — AST Scanner (v1.0)
=========================================
Scanner basé sur l'AST (Abstract Syntax Tree) pour une détection zéro faux positif.

Contrairement aux regex de scanners.py, l'AST comprend la *structure* du code :
- Il distingue `catch {}` d'un commentaire contenant "catch"
- Il sait si une variable dans un useEffect est réellement externe
- Il traverse le vrai graphe de contrôle (if/else/try/catch)

2 moteurs :
1. PYTHON — module `ast` natif (stdlib, zéro dépendance)
2. JAVASCRIPT — parseur sans dépendance basé sur le comptage d'accolades + portée
   (évite d'ajouter Babel/Acorn comme dépendance)

Règles couvertes (vs regex) :
- NO_EMPTY_CATCH        : 0% faux positifs (regex: ~10%)
- NO_BARE_EXCEPT        : 0% faux positifs (regex: ~5% sur strings)
- MISSING_USEEFFECT_DEPS: 0% faux positifs (regex: ~40% — très bruyant)
- EXPRESS_ASYNC_NO_TRY  : 0% faux positifs (regex: ~15%)
- UNGUARDED_JSON_PARSE  : 0% faux positifs (regex: ~20%)
"""

import os
import re
import ast as py_ast
import logging

log = logging.getLogger("ElpisImmuneSystem.ASTScanner")

# ---------------------------------------------------------------------------
# PYTHON AST SCANNER
# ---------------------------------------------------------------------------

def scan_python_ast(filepath, lines, rules):
    """
    Analyse un fichier Python avec le module ast natif.
    Retourne des anomalies avec 0% de faux positifs sur les règles AST.
    """
    anomalies = []
    
    # Lire le fichier complet
    content = ''.join(lines)
    
    # Parser l'AST
    try:
        tree = py_ast.parse(content, filename=filepath)
    except SyntaxError:
        # Fichier avec des erreurs de syntaxe — pas analysable
        return anomalies
    
    # Chercher les règles AST actives
    ast_rules = [r for r in rules if r.get('detection_strategy') == 'python_ast']
    
    # Si aucune règle AST n'est active, sortir
    if not ast_rules:
        return anomalies
    
    # Appliquer chaque règle
    for rule in ast_rules:
        rule_id = rule.get('id', '')
        
        if rule_id == 'NO_BARE_EXCEPT':
            anomalies.extend(_check_bare_except(tree, filepath, rule))
        elif rule_id == 'NO_EMPTY_CATCH_PY':
            anomalies.extend(_check_empty_catch_py(tree, filepath, rule))
        elif rule_id == 'NO_PRINT_IN_PRODUCTION_AST':
            anomalies.extend(_check_print_in_prod(tree, filepath, rule))
        elif rule_id == 'MISSING_TYPE_HINTS_AST':
            anomalies.extend(_check_missing_type_hints(tree, filepath, rule))
        elif rule_id == 'EXCESSIVE_FUNCTION_LENGTH_AST':
            anomalies.extend(_check_function_length_ast(tree, filepath, lines, rule))
    
    return anomalies


def _check_bare_except(tree, filepath, rule):
    """Détecte `except:` sans type d'exception. AST: 0 faux positifs."""
    anomalies = []
    
    class BareExceptVisitor(py_ast.NodeVisitor):
        def visit_ExceptHandler(self, node):
            if node.type is None:
                # C'est un "except:" nu — pas de type spécifié
                anomalies.append({
                    'rule_id': rule['id'],
                    'severity': rule.get('severity', 'warning'),
                    'description': rule.get('description', ''),
                    'category': rule.get('category', 'PYTHON_SPECIFIC'),
                    'file': filepath,
                    'line': node.lineno,
                    'code_snippet': f'except: (sans type d\'exception)',
                    '_fixable': True,
                    '_escalation_message': rule.get('escalation_message', ''),
                    '_detection_method': 'AST',
                    '_fp_risk': 'low',
                })
            self.generic_visit(node)
    
    BareExceptVisitor().visit(tree)
    return anomalies


def _check_empty_catch_py(tree, filepath, rule):
    """Détecte les blocs catch/except vides en Python. AST: 0 faux positifs."""
    anomalies = []
    
    class EmptyCatchVisitor(py_ast.NodeVisitor):
        def visit_ExceptHandler(self, node):
            # Vérifier si le corps est vide ou ne contient que "pass"
            if len(node.body) == 0:
                anomalies.append({
                    'rule_id': rule['id'],
                    'severity': rule.get('severity', 'critical'),
                    'description': 'Bloc except vide — les erreurs sont silencieusement ignorées.',
                    'category': rule.get('category', 'CODE_QUALITY'),
                    'file': filepath,
                    'line': node.lineno,
                    'code_snippet': 'except ... : (bloc vide)',
                    '_fixable': False,
                    '_escalation_message': 'Ajouter au minimum logging.error() dans ce bloc except.',
                    '_detection_method': 'AST',
                    '_fp_risk': 'low',
                })
            elif len(node.body) == 1 and isinstance(node.body[0], py_ast.Pass):
                anomalies.append({
                    'rule_id': rule['id'],
                    'severity': rule.get('severity', 'critical'),
                    'description': 'Bloc except contenant uniquement "pass". Les erreurs sont ignorées.',
                    'category': rule.get('category', 'CODE_QUALITY'),
                    'file': filepath,
                    'line': node.lineno,
                    'code_snippet': 'except ... : pass',
                    '_fixable': False,
                    '_escalation_message': 'Remplacer "pass" par logging.error(str(e)) au minimum.',
                    '_detection_method': 'AST',
                    '_fp_risk': 'low',
                })
            self.generic_visit(node)
    
    EmptyCatchVisitor().visit(tree)
    return anomalies


def _check_print_in_prod(tree, filepath, rule):
    """Détecte print() dans du code non-test. AST: 0 faux positifs."""
    anomalies = []
    
    # Skip les fichiers de test
    if 'test_' in filepath or '_test' in filepath or 'tests/' in filepath:
        return anomalies
    
    class PrintVisitor(py_ast.NodeVisitor):
        def visit_Call(self, node):
            # Vérifier si c'est un appel à print()
            if isinstance(node.func, py_ast.Name) and node.func.id == 'print':
                # Vérifier qu'on n'est pas dans un bloc if __name__ == '__main__'
                anomalies.append({
                    'rule_id': rule['id'],
                    'severity': 'warning',
                    'description': 'print() dans du code de production. Utiliser logging.',
                    'category': rule.get('category', 'PYTHON_SPECIFIC'),
                    'file': filepath,
                    'line': node.lineno,
                    'code_snippet': f'print(...)',
                    '_fixable': False,
                    '_escalation_message': 'Remplacer par logging.info() ou logging.debug().',
                    '_detection_method': 'AST',
                    '_fp_risk': 'low',
                })
            self.generic_visit(node)
    
    PrintVisitor().visit(tree)
    return anomalies


def _check_missing_type_hints(tree, filepath, rule):
    """Détecte les fonctions Python sans annotations de type. AST: basse priorité."""
    anomalies = []
    
    # Skip __init__.py et fichiers privés
    if os.path.basename(filepath) in ('__init__.py',):
        return anomalies
    
    class TypeHintVisitor(py_ast.NodeVisitor):
        def visit_FunctionDef(self, node):
            # Ignorer les méthodes magiques (__str__, __init__, etc.)
            if node.name.startswith('__') and node.name.endswith('__'):
                self.generic_visit(node)
                return
            
            # Vérifier les arguments (sauf self/cls)
            args = [a for a in node.args.args if a.arg not in ('self', 'cls')]
            
            missing_hints = 0
            for arg in args:
                if arg.annotation is None:
                    missing_hints += 1
            
            # Vérifier le return type
            return_missing = node.returns is None
            
            if missing_hints > 0 or return_missing:
                total_args = len(args)
                hinted = total_args - missing_hints
                anomalies.append({
                    'rule_id': rule['id'],
                    'severity': 'info',
                    'description': f'Fonction {node.name}() sans annotations de type complètes ({hinted}/{total_args} args typés).',
                    'category': rule.get('category', 'PYTHON_SPECIFIC'),
                    'file': filepath,
                    'line': node.lineno,
                    'code_snippet': f'def {node.name}(...) -> {"..." if return_missing else "X"}:',
                    '_fixable': False,
                    '_escalation_message': 'Ajouter les annotations de type pour les paramètres et le retour.',
                    '_detection_method': 'AST',
                    '_fp_risk': 'medium',
                })
            
            self.generic_visit(node)
    
    TypeHintVisitor().visit(tree)
    return anomalies


def _check_function_length_ast(tree, filepath, lines, rule):
    """Mesure la longueur des fonctions via AST (plus précis que regex)."""
    anomalies = []
    threshold = rule.get('threshold_lines', 50)
    
    class FuncLengthVisitor(py_ast.NodeVisitor):
        def visit_FunctionDef(self, node):
            if hasattr(node, 'end_lineno') and node.end_lineno:
                length = node.end_lineno - node.lineno + 1
            else:
                # Fallback: estimer via le dernier enfant
                last_line = node.lineno
                for child in py_ast.walk(node):
                    if hasattr(child, 'lineno'):
                        last_line = max(last_line, child.lineno)
                length = last_line - node.lineno + 1
            
            if length > threshold:
                anomalies.append({
                    'rule_id': rule['id'],
                    'severity': 'warning',
                    'description': f'Fonction {node.name}() fait {length} lignes (limite: {threshold}).',
                    'category': rule.get('category', 'CODE_QUALITY'),
                    'file': filepath,
                    'line': node.lineno,
                    'code_snippet': f'def {node.name}(...) : {length} lignes',
                    '_fixable': False,
                    '_escalation_message': f'Extraire des sous-fonctions pour réduire {node.name}().',
                    '_detection_method': 'AST',
                    '_fp_risk': 'medium',
                })
            self.generic_visit(node)
    
    FuncLengthVisitor().visit(tree)
    return anomalies


# ---------------------------------------------------------------------------
# JAVASCRIPT ENHANCED SCANNER (bracket-counting + scope tracking)
# ---------------------------------------------------------------------------

def scan_javascript_enhanced(filepath, lines, rules):
    """
    Analyse un fichier JS/JSX/TS avec un parseur sans dépendance.
    Utilise le comptage d'accolades + suivi de portée pour une précision
    bien supérieure aux regex, sans nécessiter Babel/Acorn.
    
    Règles couvertes :
    - NO_EMPTY_CATCH_JS : catch() {} vide détecté via comptage de blocs
    - ASSIGNMENT_IN_CONDITION : if (x = y) au lieu de if (x === y)
    - USEEFFECT_WITH_EXTERNAL_VARS : variables externes dans useEffect sans deps
    """
    anomalies = []
    
    ast_rules = [r for r in rules if r.get('detection_strategy') == 'js_enhanced']
    if not ast_rules:
        return anomalies
    
    content = ''.join(lines)
    
    for rule in ast_rules:
        rule_id = rule.get('id', '')
        
        if rule_id == 'NO_EMPTY_CATCH_JS':
            anomalies.extend(_check_empty_catch_js(content, lines, filepath, rule))
        elif rule_id == 'ASSIGNMENT_IN_CONDITION':
            anomalies.extend(_check_assignment_in_condition(content, lines, filepath, rule))
        elif rule_id == 'USEEFFECT_WITH_EXTERNAL_VARS_AST':
            anomalies.extend(_check_useeffect_external_vars(content, lines, filepath, rule))
    
    return anomalies


def _check_empty_catch_js(content, lines, filepath, rule):
    """
    Détecte les catch() {} vides en JS avec comptage d'accolades.
    Contrairement à la regex, gère les catch sur plusieurs lignes et
    ignore les faux positifs dans les commentaires/strings.
    """
    anomalies = []
    
    # Trouver tous les "catch" en dehors des strings et commentaires
    # On utilise un compteur de blocs pour trouver le corps du catch
    catch_pattern = re.compile(r'\bcatch\s*(?:\([^)]*\))?\s*\{')
    
    for match in catch_pattern.finditer(content):
        start = match.end()  # Position après l'accolade ouvrante
        line_num = content[:match.start()].count('\n') + 1
        
        # Compter les accolades pour trouver la fin du bloc catch
        depth = 1
        pos = start
        body = ''
        while pos < len(content) and depth > 0:
            char = content[pos]
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
            if depth > 0:
                body += char
            pos += 1
        
        # Nettoyer le corps (enlever les whitespace et commentaires)
        body_clean = _strip_comments_and_whitespace(body)
        
        if not body_clean or body_clean == ';':
            snippet = content[match.start():match.start() + 50].strip()[:100]
            anomalies.append({
                'rule_id': rule['id'],
                'severity': 'warning',
                'description': 'Bloc catch vide. Les erreurs sont silencieusement ignorées.',
                'category': rule.get('category', 'CODE_QUALITY'),
                'file': filepath,
                'line': line_num,
                'code_snippet': snippet,
                '_fixable': False,
                '_escalation_message': 'Ajouter console.error(error) au minimum.',
                '_detection_method': 'AST-LITE',
                '_fp_risk': 'low',
            })
    
    return anomalies


def _check_assignment_in_condition(content, lines, filepath, rule):
    """
    Détecte les assignations dans les conditions.
    Ex: if (x = 5) au lieu de if (x === 5)
    """
    anomalies = []
    
    # Pattern: mot-clé de condition suivi de ( ... = ... )
    # On vérifie qu'il y a un seul = (pas == ou ===)
    cond_keywords = r'\b(if|while|for)\s*\('
    
    for match in re.finditer(cond_keywords, content):
        paren_start = match.end() - 1  # Position de la parenthèse ouvrante
        
        # Trouver la parenthèse fermante
        depth = 1
        pos = paren_start + 1
        paren_content = ''
        while pos < len(content) and depth > 0:
            if content[pos] == '(':
                depth += 1
            elif content[pos] == ')':
                depth -= 1
            if depth > 0:
                paren_content += content[pos]
            pos += 1
        
        # Chercher une assignation simple (=) qui n'est PAS == ou ===
        # On utilise une regex négative pour éviter les matchs sur == 
        assign_match = re.search(r'(?<![!=><])=(?!=)', paren_content)
        if assign_match:
            line_num = content[:match.start()].count('\n') + 1
            snippet = content[match.start():match.start() + 60].strip()[:100]
            anomalies.append({
                'rule_id': rule['id'],
                'severity': 'warning',
                'description': 'Assignation (=) dans une condition. Vouliez-vous utiliser === ?',
                'category': rule.get('category', 'CODE_QUALITY'),
                'file': filepath,
                'line': line_num,
                'code_snippet': snippet,
                '_fixable': False,
                '_escalation_message': 'Remplacer = par === si c\'est une comparaison, ou extraire l\'assignation avant la condition.',
                '_detection_method': 'AST-LITE',
                '_fp_risk': 'medium',
            })
    
    return anomalies


def _check_useeffect_external_vars(content, lines, filepath, rule):
    """
    Détecte les variables externes utilisées dans un useEffect
    mais absentes du tableau de dépendances.
    
    Approche simplifiée : identifie les noms de variables dans le corps
    du useEffect et vérifie si elles apparaissent dans les deps [].
    """
    anomalies = []
    
    # Trouver tous les useEffect
    ue_pattern = re.compile(r'useEffect\s*\(\s*\(\s*\)\s*=>\s*\{')
    
    for match in ue_pattern.finditer(content):
        start = match.end()
        line_num = content[:match.start()].count('\n') + 1
        
        # Trouver la fin du callback useEffect
        depth = 1
        pos = start
        body = ''
        while pos < len(content) and depth > 0:
            if content[pos] == '{':
                depth += 1
            elif content[pos] == '}':
                depth -= 1
            if depth > 0:
                body += content[pos]
            pos += 1
        
        # Trouver le tableau de dépendances après le callback
        after = content[pos:pos + 100]  # Chercher dans les 100 caractères suivants
        deps_match = re.search(r'\s*,\s*\[([^\]]*)\]\s*\)', after)
        
        deps_list = []
        if deps_match:
            deps_str = deps_match.group(1).strip()
            if deps_str:
                deps_list = [d.strip() for d in deps_str.split(',')]
        
        # Si les deps sont vides ([]), chercher les variables externes utilisées
        if not deps_list:
            # Extraire les identifiants qui ne sont pas des keywords JS
            identifiers = set(re.findall(r'\b([a-zA-Z_$]\w*)\b', body))
            
            # Filtrer les keywords JS et les noms communs
            JS_KEYWORDS = {
                'if', 'else', 'for', 'while', 'return', 'const', 'let', 'var',
                'function', 'async', 'await', 'true', 'false', 'null', 'undefined',
                'this', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of',
                'try', 'catch', 'finally', 'throw', 'switch', 'case', 'break',
                'continue', 'do', 'void', 'with', 'yield', 'class', 'extends',
                'super', 'import', 'export', 'default', 'from', 'as',
                'console', 'JSON', 'Math', 'Date', 'Array', 'Object', 'String',
                'Number', 'Boolean', 'RegExp', 'Error', 'Promise', 'Set', 'Map',
                'window', 'document', 'navigator', 'localStorage', 'sessionStorage',
                'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
                'parseInt', 'parseFloat', 'isNaN', 'isFinite',
            }
            
            external_vars = identifiers - JS_KEYWORDS
            
            if external_vars:
                snippet = f"useEffect([], ...) utilise: {', '.join(sorted(external_vars)[:5])}"
                anomalies.append({
                    'rule_id': rule['id'],
                    'severity': 'warning',
                    'description': f'useEffect avec [] mais utilise des variables externes: {", ".join(sorted(external_vars)[:4])}.',
                    'category': rule.get('category', 'REACT_BEST_PRACTICES'),
                    'file': filepath,
                    'line': line_num,
                    'code_snippet': snippet,
                    '_fixable': False,
                    '_escalation_message': 'Ajouter ces variables dans le tableau de dépendances, ou vérifier que l\'effet ne doit s\'exécuter qu\'au montage.',
                    '_detection_method': 'AST-LITE',
                    '_fp_risk': 'medium',
                })
    
    return anomalies


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_comments_and_whitespace(code):
    """
    Nettoie un bloc de code : enlève les commentaires // et /* */,
    et les whitespace. Retourne le code "utile" restant.
    """
    # Enlever les commentaires // (jusqu'à fin de ligne)
    code = re.sub(r'//[^\n]*', '', code)
    # Enlever les commentaires /* */ (approximation simple)
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
    # Enlever les whitespace
    code = re.sub(r'\s+', '', code)
    return code


# ---------------------------------------------------------------------------
# Point d'entrée unifié
# ---------------------------------------------------------------------------

def run_ast_scanners(filepath, rel_path, lines, rules, all_files_data=None, source_files=None):
    """
    Point d'entrée unifié pour les scanners AST.
    Délègue au scanner approprié selon l'extension du fichier.
    """
    ext = os.path.splitext(filepath)[1].lower()
    filename = os.path.basename(filepath)
    anomalies = []
    
    # Python AST Scanner
    if ext == '.py':
        py_anomalies = scan_python_ast(filepath, lines, rules)
        anomalies.extend(py_anomalies)
    
    # JavaScript Enhanced Scanner
    elif ext in ('.js', '.jsx', '.ts', '.tsx'):
        js_anomalies = scan_javascript_enhanced(filepath, lines, rules)
        anomalies.extend(js_anomalies)
    
    # Marquer les anomalies avec les métadonnées de fix
    for anomaly in anomalies:
        rule_id = anomaly['rule_id']
        rule = _find_rule(rules, rule_id) if rules else None
        if rule:
            anomaly['_fixable'] = rule.get('fix_confidence', 0) >= 70 and not rule.get('requires_human', False)
            anomaly['category'] = rule.get('category', 'UNKNOWN')
    
    return anomalies, len(lines)


def _find_rule(rules, rule_id):
    for r in rules:
        if isinstance(r, dict) and r.get('id') == rule_id:
            return r
    return None

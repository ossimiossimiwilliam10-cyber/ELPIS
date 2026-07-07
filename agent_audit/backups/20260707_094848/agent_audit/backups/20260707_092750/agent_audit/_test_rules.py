"""
ELPIS Immune System v3.2 — Tests anti-regression pour rules.json et scanners.
Execute: python _test_rules.py
"""
import sys
import re
import os

# Assurer que le repertoire courant est le bon
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from engine import load_rules
from scanners import (scan_regex, _scan_useeffect_cleanup, _scan_unguarded_json_parse,
                       _scan_express_async_handlers)

PASSED = 0
FAILED = 0

def test(name, condition, detail=''):
    global PASSED, FAILED
    if condition:
        PASSED += 1
        print(f'  [OK] {name}')
    else:
        FAILED += 1
        print(f'  [FAIL] {name} {detail}')


# ===========================================================================
# 1. RULES.JSON INTEGRITY
# ===========================================================================
print('\n=== 1. INTEGRITE DE RULES.JSON ===')

rules, meta = load_rules('rules.json')
test('Regles chargees', len(rules) > 0, f'got {len(rules)}')
test('Version 3.2.0', meta.get('version') == '3.2.0', f'got {meta.get("version")}')
test('Total regles = 57', meta.get('total_rules') == 57, f'got {meta.get("total_rules")}')
test('Nombre reel de regles = 57', len(rules) == 57, f'got {len(rules)}')

# Check all rules have required fields
required_fields = ['id', 'severity', 'description', 'patterns']
for r in rules:
    if not isinstance(r, dict):
        continue
    for field in required_fields:
        test(f'Champ "{field}" dans {r.get("id", "?")}', field in r)

# Check for duplicate IDs
ids = [r['id'] for r in rules if isinstance(r, dict) and 'id' in r]
duplicates = [rid for rid in ids if ids.count(rid) > 1]
test('Pas de doublons d\'IDs', len(duplicates) == 0, f'doublons: {set(duplicates)}')

# Check severities are valid
for r in rules:
    if isinstance(r, dict):
        test(f'Severite valide pour {r["id"]}',
             r.get('severity') in ('critical', 'warning', 'info'),
             f'got {r.get("severity")}')

# Check that fix_confidence are integers (AGENTS.md rule)
for r in rules:
    if isinstance(r, dict) and 'fix_confidence' in r:
        val = r['fix_confidence']
        test(f'fix_confidence entier pour {r["id"]}',
             isinstance(val, int) or (isinstance(val, float) and val == int(val)),
             f'got {val} (type: {type(val).__name__})')

# Check patterns compile
SPECIAL_PATTERNS = {'CIRCULAR_DETECTED', 'LAYER_VIOLATION', 'FILE_LINE_COUNT_CHECK',
                    'FUNCTION_LENGTH_CHECK', 'NESTING_DEPTH_CHECK', 'TEST_COVERAGE_CHECK',
                    'scan_pwa_static_exclusions', 'scan_useeffect_cleanup_interval',
                    'scan_useeffect_cleanup_listener', 'scan_unguarded_json_parse',
                    'scan_express_async_handlers', 'scan_fetch_without_abort'}
for r in rules:
    if not isinstance(r, dict):
        continue
    for p in r.get('patterns', []):
        if p in SPECIAL_PATTERNS:
            continue
        try:
            re.compile(p)
            test(f'Pattern compile pour {r["id"]}: {p[:50]}', True)
        except re.error as e:
            test(f'Pattern compile pour {r["id"]}', False, str(e))


# ===========================================================================
# 2. NEW v3.2 RULES EXISTENCE
# ===========================================================================
print('\n=== 2. NOUVELLES REGLES v3.2 ===')

NEW_RULE_IDS = [
    'USEEFFECT_MISSING_CLEANUP_INTERVAL',
    'USEEFFECT_MISSING_CLEANUP_LISTENER',
    'UNGUARDED_JSON_PARSE',
    'EMPTY_PROMISE_CATCH',
    'JSON_DEEP_CLONE',
    'EXPRESS_ASYNC_NO_TRY_CATCH',
    'TOAST_DIRECT_CALL',
    'ZUSTAND_FULL_STORE_DESTRUCTURE',
    'NO_WINDOW_PROMPT',
    'FETCH_WITHOUT_ABORT',
    'FIX_CONFIDENCE_DECIMAL',
]

for rid in NEW_RULE_IDS:
    test(f'Regle "{rid}" existe', rid in ids)

# Check ELPIS_SPECIFIC category exists
cats = set(r.get('category') for r in rules if isinstance(r, dict))
test('Categorie ELPIS_SPECIFIC existe', 'ELPIS_SPECIFIC' in cats)


# ===========================================================================
# 3. CUSTOM SCANNER UNIT TESTS
# ===========================================================================
print('\n=== 3. TESTS UNITAIRES DES SCANNERS CUSTOM ===')

# Build a fake rule for testing
def fake_rule(rule_id, severity='warning'):
    return {
        'id': rule_id, 'severity': severity, 'description': 'test',
        'patterns': [], 'category': 'TEST', 'file_pattern': '.*',
        'escalation_message': 'test', 'suppression_comment': ''
    }

# --- Test useEffect cleanup scanner (setInterval) ---
print('\n  --- useEffect cleanup (setInterval) ---')

code_no_cleanup = [
    'function MyComponent() {\n',
    '  useEffect(() => {\n',
    '    const id = setInterval(() => { console.log("tick"); }, 1000);\n',
    '  }, []);\n',
    '}\n',
]
result = _scan_useeffect_cleanup(code_no_cleanup, 'test.jsx', fake_rule('TEST'), 'setInterval', 'clearInterval')
test('Detecte setInterval sans cleanup', len(result) == 1)

code_with_cleanup = [
    'function MyComponent() {\n',
    '  useEffect(() => {\n',
    '    const id = setInterval(() => { console.log("tick"); }, 1000);\n',
    '    return () => clearInterval(id);\n',
    '  }, []);\n',
    '}\n',
]
result = _scan_useeffect_cleanup(code_with_cleanup, 'test.jsx', fake_rule('TEST'), 'setInterval', 'clearInterval')
test('Ignore setInterval avec cleanup', len(result) == 0)

code_no_interval = [
    'function MyComponent() {\n',
    '  useEffect(() => {\n',
    '    console.log("hello");\n',
    '  }, []);\n',
    '}\n',
]
result = _scan_useeffect_cleanup(code_no_interval, 'test.jsx', fake_rule('TEST'), 'setInterval', 'clearInterval')
test('Ignore useEffect sans setInterval', len(result) == 0)

# --- Test useEffect cleanup scanner (addEventListener) ---
print('\n  --- useEffect cleanup (addEventListener) ---')

code_listener_no_cleanup = [
    'function MyComponent() {\n',
    '  useEffect(() => {\n',
    '    window.addEventListener("keydown", handler);\n',
    '  }, []);\n',
    '}\n',
]
result = _scan_useeffect_cleanup(code_listener_no_cleanup, 'test.jsx', fake_rule('TEST'), 'addEventListener', 'removeEventListener')
test('Detecte addEventListener sans cleanup', len(result) == 1)

code_listener_with_cleanup = [
    'function MyComponent() {\n',
    '  useEffect(() => {\n',
    '    window.addEventListener("keydown", handler);\n',
    '    return () => {\n',
    '      window.removeEventListener("keydown", handler);\n',
    '    };\n',
    '  }, []);\n',
    '}\n',
]
result = _scan_useeffect_cleanup(code_listener_with_cleanup, 'test.jsx', fake_rule('TEST'), 'addEventListener', 'removeEventListener')
test('Ignore addEventListener avec cleanup', len(result) == 0)

# --- Test unguarded JSON.parse scanner ---
print('\n  --- Unguarded JSON.parse ---')

code_json_unguarded = [
    'const data = JSON.parse(raw);\n',
]
result = _scan_unguarded_json_parse(code_json_unguarded, 'test.js', fake_rule('TEST'))
test('Detecte JSON.parse sans try/catch', len(result) == 1)

code_json_guarded = [
    'try {\n',
    '  const data = JSON.parse(raw);\n',
    '} catch (e) {\n',
    '  console.error(e);\n',
    '}\n',
]
result = _scan_unguarded_json_parse(code_json_guarded, 'test.js', fake_rule('TEST'))
test('Ignore JSON.parse dans try/catch', len(result) == 0)

# --- Test Express async handler scanner ---
print('\n  --- Express async handlers ---')

code_async_no_try = [
    'app.get("/api/data", async (req, res) => {\n',
    '  const data = await fetchData();\n',
    '  res.json(data);\n',
    '});\n',
]
result = _scan_express_async_handlers(code_async_no_try, 'server.js', fake_rule('TEST'))
test('Detecte async handler sans try/catch', len(result) == 1)

code_async_with_try = [
    'app.get("/api/data", async (req, res) => {\n',
    '  try {\n',
    '    const data = await fetchData();\n',
    '    res.json(data);\n',
    '  } catch (e) {\n',
    '    res.status(500).json({ error: e.message });\n',
    '  }\n',
    '});\n',
]
result = _scan_express_async_handlers(code_async_with_try, 'server.js', fake_rule('TEST'))
test('Ignore async handler avec try/catch', len(result) == 0)

# --- Test regex-based new rules ---
print('\n  --- Regex-based new rules ---')

# EMPTY_PROMISE_CATCH
code_empty_catch = ['fetch(url).catch(() => {})\n']
empty_catch_rule = next(r for r in rules if isinstance(r, dict) and r.get('id') == 'EMPTY_PROMISE_CATCH')
result = scan_regex(code_empty_catch, 'src/store.js', 'store.js', [empty_catch_rule])
test('Detecte .catch(() =>) vide', len(result) >= 1)

# JSON_DEEP_CLONE
code_deep_clone = ['const copy = JSON.parse(JSON.stringify(obj));\n']
deep_clone_rule = next(r for r in rules if isinstance(r, dict) and r.get('id') == 'JSON_DEEP_CLONE')
result = scan_regex(code_deep_clone, 'src/store.js', 'store.js', [deep_clone_rule])
test('Detecte JSON deep clone', len(result) >= 1)

# TOAST_DIRECT_CALL
code_toast_bad = ['toast("success message")\n']
toast_rule = next(r for r in rules if isinstance(r, dict) and r.get('id') == 'TOAST_DIRECT_CALL')
result = scan_regex(code_toast_bad, 'src/App.jsx', 'App.jsx', [toast_rule])
test('Detecte toast() direct', len(result) >= 1)

code_toast_good = ['toast.success("success message")\n']
result = scan_regex(code_toast_good, 'src/App.jsx', 'App.jsx', [toast_rule])
test('Ignore toast.success()', len(result) == 0)

# ZUSTAND_FULL_STORE_DESTRUCTURE
code_zustand_bad = ['const { a, b, c } = useStore();\n']
zustand_rule = next(r for r in rules if isinstance(r, dict) and r.get('id') == 'ZUSTAND_FULL_STORE_DESTRUCTURE')
result = scan_regex(code_zustand_bad, 'src/App.jsx', 'App.jsx', [zustand_rule])
test('Detecte useStore() sans selecteur', len(result) >= 1)

# NO_WINDOW_PROMPT
code_prompt = ['const val = window.prompt("Enter value:");\n']
prompt_rule = next(r for r in rules if isinstance(r, dict) and r.get('id') == 'NO_WINDOW_PROMPT')
result = scan_regex(code_prompt, 'src/Component.jsx', 'Component.jsx', [prompt_rule])
test('Detecte window.prompt()', len(result) >= 1)

# FIX_CONFIDENCE_DECIMAL
code_decimal = ['"fix_confidence": 0.95\n']
decimal_rule = next(r for r in rules if isinstance(r, dict) and r.get('id') == 'FIX_CONFIDENCE_DECIMAL')
result = scan_regex(code_decimal, 'rules.json', 'rules.json', [decimal_rule])
test('Detecte fix_confidence decimal', len(result) >= 1)

code_int = ['"fix_confidence": 95\n']
result = scan_regex(code_int, 'rules.json', 'rules.json', [decimal_rule])
test('Ignore fix_confidence entier', len(result) == 0)


# ===========================================================================
# 4. SUMMARY
# ===========================================================================
print(f'\n{"="*50}')
print(f'RESULTATS: {PASSED} passes, {FAILED} echecs')
print(f'{"="*50}')

if FAILED > 0:
    print('\n[!] DES TESTS ONT ECHOUE. Veuillez corriger avant de deployer.')
    sys.exit(1)
else:
    print('\n[OK] Tous les tests passent. Le systeme immunitaire v3.2 est operationnel.')
    sys.exit(0)

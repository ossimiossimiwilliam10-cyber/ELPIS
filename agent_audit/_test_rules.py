from engine import load_rules

rules, meta = load_rules('rules.json')
print(f'OK: {len(rules)} regles, version {meta.get("version", "?")}')

cats = set(r.get('category', '?') for r in rules if isinstance(r, dict))
print(f'Categories: {sorted(cats)}')

sevs = {}
for r in rules:
    if isinstance(r, dict):
        s = r.get('severity', '?')
        sevs[s] = sevs.get(s, 0) + 1
print(f'Severites: {sevs}')

# Check rules with auto-fix
auto_fixable = [r['id'] for r in rules if isinstance(r, dict) and r.get('fix_confidence', 0) >= 70]
print(f'Auto-fixables (confiance >= 70%): {auto_fixable}')

# Check emergency rules
emergency = [r['id'] for r in rules if isinstance(r, dict) and r.get('emergency_mode')]
print(f'Regles urgence: {emergency}')

# Check rules needing human
human = [r['id'] for r in rules if isinstance(r, dict) and r.get('requires_human')]
print(f'Regles humain-obligatoire: {human}')

# Check detection strategies
strategies = set(r.get('detection_strategy', 'regex') for r in rules if isinstance(r, dict))
print(f'Strategies de detection: {strategies}')

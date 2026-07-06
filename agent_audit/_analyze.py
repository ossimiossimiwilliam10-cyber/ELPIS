import json
d = json.load(open('data/espoir_audit.json', 'r', encoding='utf-8'))

print('=== RULE STATS (full visibility) ===')
rs = d.get('rule_stats', {})
for rid, stats in sorted(rs.items(), key=lambda x: -x[1]['count']):
    print(f"  {rid:<40} {stats['severity']:<9} {stats['category']:<20} "
          f"count={stats['count']:>5}  files={stats['files_affected']:>3}  "
          f"fixable={stats['fixable_count']:>4}  fixed={stats['auto_fixed_count']:>4}  "
          f"pct={stats['pct_of_total']:>5}%")

print(f"\n=== HEALTH SCORE: {d.get('health_score')}/100 ===")
print(f"Mode: {d.get('mode')}")
print(f"Files: {d.get('files_scanned')}, Lines: {d.get('total_lines_of_code')}")
print(f"Anomalies: {d.get('total_anomalies')} (C:{d['anomalies_by_severity']['critical']} "
      f"W:{d['anomalies_by_severity']['warning']} I:{d['anomalies_by_severity']['info']})")
print(f"Corrections: {d.get('total_corrections')}, Escalations: {d.get('total_escalations')}")

# Check critical anomalies details
crits = [a for a in d.get('anomalies', []) if a.get('severity') == 'critical']
print(f"\n=== CRITICALS ({len(crits)} in sample, {d['anomalies_by_severity']['critical']} total) ===")
from collections import Counter
cc = Counter(a['rule_id'] for a in crits)
for rid, cnt in cc.most_common():
    sample = next(a for a in crits if a['rule_id'] == rid)
    print(f"  {rid}: {cnt} — {sample.get('description','')[:100]}")
    if sample.get('file'):
        print(f"    -> {sample['file']}:{sample['line']}")

print(f"\n=== ESCALATIONS ===")
for e in d.get('escalations', [])[:5]:
    print(f"  [{e.get('type')}] {e.get('rule_id')} lvl={e.get('level')}")

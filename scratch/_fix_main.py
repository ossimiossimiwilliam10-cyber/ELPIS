
with open('agent_audit/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

old = "        'signal_count': 0,  # Rempli ci-dessous\n        'noise_count': 0,"
new = ("        'signal_count': sum(1 for a in anomalies\n"
       "                          if a.get('severity') in ('critical', 'warning')\n"
       "                          and a.get('_fp_risk', 'medium') != 'high'),\n"
       "        'noise_count': sum(1 for a in anomalies\n"
       "                         if a.get('severity') == 'info'\n"
       "                         or a.get('_fp_risk') == 'high'),")

if old in content:
    content = content.replace(old, new)
    with open('agent_audit/main.py', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed signal_count/noise_count in main.py')
else:
    print('Pattern not found or already fixed')
    # Debug: find signal_count
    idx = content.find('signal_count')
    if idx >= 0:
        print('Found at offset', idx)
        print(repr(content[idx:idx+80]))

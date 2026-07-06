import os
import re
import json
import time
import datetime

# Configuration
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RULES_FILE = os.path.join(PROJECT_ROOT, 'agent_audit', 'rules.json')
OUTPUT_FILE = os.path.join(PROJECT_ROOT, 'data', 'espoir_audit.json')
DIRECTORIES_TO_SCAN = [
    os.path.join(PROJECT_ROOT, 'interface', 'web', 'src'),
    os.path.join(PROJECT_ROOT, 'interface', 'bridge')
]
SCAN_INTERVAL_SECONDS = 14400 # 4 hours

def load_rules():
    try:
        with open(RULES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[{datetime.datetime.now()}] Erreur lecture rules.json : {e}")
        return []

def scan_file(filepath, rules):
    anomalies = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        filename = os.path.basename(filepath)
        
        for rule in rules:
            # Check if file matches file_pattern
            if not re.search(rule.get('file_pattern', '.*'), filename):
                continue
            # Check if file matches exclude_pattern
            if rule.get('exclude_pattern') and re.search(rule.get('exclude_pattern'), filename):
                continue
                
            pattern = re.compile(rule['pattern'])
            
            # Check line by line for violations
            for i, line in enumerate(lines):
                if pattern.search(line):
                    anomalies.append({
                        "rule_id": rule['id'],
                        "severity": rule['severity'],
                        "description": rule['description'],
                        "file": filepath.replace(PROJECT_ROOT, ''),
                        "line": i + 1,
                        "code_snippet": line.strip()
                    })
    except Exception as e:
        print(f"Impossible de lire {filepath}: {e}")
    return anomalies

def run_audit():
    print(f"[{datetime.datetime.now()}] Démarrage de l'audit complet du code...")
    rules = load_rules()
    if not rules:
        print("Aucune règle trouvée. Fin de l'audit.")
        return

    all_anomalies = []
    files_scanned = 0

    for directory in DIRECTORIES_TO_SCAN:
        if not os.path.exists(directory):
            continue
        for root, dirs, files in os.walk(directory):
            if 'node_modules' in dirs:
                dirs.remove('node_modules')
            if '.git' in dirs:
                dirs.remove('.git')
                
            for file in files:
                filepath = os.path.join(root, file)
                if file.endswith('.js') or file.endswith('.jsx'):
                    files_scanned += 1
                    anomalies = scan_file(filepath, rules)
                    all_anomalies.extend(anomalies)

    report = {
        "last_scan": datetime.datetime.now().isoformat(),
        "files_scanned": files_scanned,
        "total_anomalies": len(all_anomalies),
        "anomalies": all_anomalies
    }

    # S'assurer que le dossier data existe
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=4, ensure_ascii=False)
        
    print(f"[{datetime.datetime.now()}] Audit terminé. {files_scanned} fichiers scannés. {len(all_anomalies)} anomalies trouvées.")

if __name__ == "__main__":
    import sys
    print("=== ELPIS Python Audit Agent ===")
    if "--once" in sys.argv:
        run_audit()
        sys.exit(0)
        
    print("Agent démarré. Il s'exécutera toutes les 4 heures en arrière-plan.")
    while True:
        run_audit()
        print(f"Prochain audit dans 4 heures...")
        time.sleep(SCAN_INTERVAL_SECONDS)

import sys
import os

filepath = r'c:\Users\User\Desktop\ELPIS\agent_audit\main.py'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "import os" in line and i < 20:
        new_lines.append(line)
        if "from linters import" not in "".join(lines[:30]):
            new_lines.append("from linters import get_all_linter_anomalies\n")
            new_lines.append("from collections import defaultdict\n")
            new_lines.append("import datetime\n")
        continue

    if "log.info(\"Phase 3: Scan individuel des fichiers et corrections...\")" in line:
        skip = True
        new_lines.append('    log.info("Phase 3: Execution des linters standards (ESLint, Ruff)...")\n')
        new_lines.append('    \n')
        new_lines.append('    all_anomalies = list(global_anomalies)\n')
        new_lines.append('    all_corrections = []\n')
        new_lines.append('    all_escalations = []\n')
        new_lines.append('    files_corrected = set()\n')
        new_lines.append('    rule_hit_count = defaultdict(int)\n')
        new_lines.append('    \n')
        new_lines.append('    if not dry_run:\n')
        new_lines.append('        linter_anomalies = get_all_linter_anomalies(PROJECT_ROOT, fix=False)\n')
        new_lines.append('        fixable_by_file = defaultdict(list)\n')
        new_lines.append('        for a in linter_anomalies:\n')
        new_lines.append('            if a.get("_fixable"):\n')
        new_lines.append('                fixable_by_file[a["file"]].append(a)\n')
        new_lines.append('                \n')
        new_lines.append('        for rel_path, anomalies in fixable_by_file.items():\n')
        new_lines.append('            filepath = os.path.join(PROJECT_ROOT, rel_path)\n')
        new_lines.append('            ext = os.path.splitext(filepath)[1].lower()\n')
        new_lines.append('            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")\n')
        new_lines.append('            timestamp_dir = os.path.join(BACKUPS_DIR, timestamp)\n')
        new_lines.append('            from fixers import create_backup\n')
        new_lines.append('            try:\n')
        new_lines.append('                backup_path = create_backup(filepath, timestamp_dir)\n')
        new_lines.append('            except Exception:\n')
        new_lines.append('                backup_path = None\n')
        new_lines.append('                \n')
        new_lines.append('            if ext in (".js", ".jsx", ".ts", ".tsx"):\n')
        new_lines.append('                subprocess.run(["npx", "eslint", rel_path, "--fix"], cwd=PROJECT_ROOT, capture_output=True)\n')
        new_lines.append('            elif ext == ".py":\n')
        new_lines.append('                subprocess.run(["python", "-m", "ruff", "check", rel_path, "--fix"], cwd=PROJECT_ROOT, capture_output=True)\n')
        new_lines.append('                \n')
        new_lines.append('            validation_ok = validate_after_fix(filepath, run_tests=True)\n')
        new_lines.append('            if not validation_ok:\n')
        new_lines.append('                log.warning(f"  [ROLLBACK] Validation echouee pour {rel_path}")\n')
        new_lines.append('                if backup_path:\n')
        new_lines.append('                    rollback_file(filepath, backup_path)\n')
        new_lines.append('            else:\n')
        new_lines.append('                files_corrected.add(rel_path)\n')
        new_lines.append('                for a in anomalies:\n')
        new_lines.append('                    all_corrections.append({"rule_id": a["rule_id"], "file": rel_path, "line": a["line"], "before": "", "after": "Fixed by linter"})\n')
        new_lines.append('    \n')
        new_lines.append('    final_anomalies = get_all_linter_anomalies(PROJECT_ROOT, fix=False)\n')
        new_lines.append('    for a in final_anomalies:\n')
        new_lines.append('        rule_hit_count[a["rule_id"]] += 1\n')
        new_lines.append('    all_anomalies.extend(final_anomalies)\n')
        new_lines.append('    \n')
        new_lines.append('    log.info(f"  Passe 1: {len(final_anomalies)} defauts trouves, {len(all_corrections)} corrections appliquees")\n')
        continue
        
    if skip and "--- 7. Verifier les faux positifs potentiels ---" in line:
        skip = False
        
    if not skip:
        new_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

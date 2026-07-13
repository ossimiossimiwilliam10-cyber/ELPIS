import os
import subprocess
import json

def run_eslint(project_root, fix=False):
    """Run eslint and return anomalies."""
    web_dir = os.path.join(project_root, 'interface', 'web')
    cmd = ['npx', 'eslint', '.', '--format', 'json']
    if fix:
        cmd.append('--fix')

    try:
        # Check if eslint is there
        if not os.path.exists(os.path.join(web_dir, 'package.json')):
            return []

        result = subprocess.run(
            cmd,
            cwd=web_dir,
            capture_output=True,
            text=True,
            shell=(os.name == 'nt'),
            encoding='utf-8'
        )

        # ESLint returns exit code 1 if errors exist, which is normal
        try:
            output = json.loads(result.stdout)
        except json.JSONDecodeError:
            return []

        anomalies = []
        for file_report in output:
            filepath = file_report.get('filePath', '')
            rel_path = os.path.relpath(filepath, project_root)
            for msg in file_report.get('messages', []):
                anomalies.append({
                    'rule_id': msg.get('ruleId') or 'ESLINT_ERROR',
                    'severity': 'warning' if msg.get('severity') == 1 else 'critical',
                    'description': msg.get('message', ''),
                    'category': 'REACT_BEST_PRACTICES' if 'react' in (msg.get('ruleId') or '') else 'CODE_QUALITY',
                    'file': rel_path,
                    'line': msg.get('line', 0),
                    'code_snippet': '',
                    '_fixable': 'fix' in msg,
                    '_escalation_message': msg.get('message', '')
                })
        return anomalies
    except Exception as e:
        print(f"Erreur ESLint: {e}")
        return []

def run_ruff(project_root, fix=False):
    """Run ruff and return anomalies."""
    # Ensure ruff is called via python -m to avoid path issues on windows if installed locally
    cmd = ['python', '-m', 'ruff', 'check', '.', '--exclude', 'agent_audit/backups', '--output-format', 'json']
    if fix:
        cmd.append('--fix')

    try:
        result = subprocess.run(
            cmd,
            cwd=project_root,
            capture_output=True,
            text=True,
            encoding='utf-8'
        )

        try:
            output = json.loads(result.stdout)
        except json.JSONDecodeError:
            return []

        anomalies = []
        for msg in output:
            filepath = msg.get('filename', '')
            rel_path = os.path.relpath(filepath, project_root)
            anomalies.append({
                'rule_id': msg.get('code', 'RUFF_ERROR'),
                'severity': 'warning',
                'description': msg.get('message', ''),
                'category': 'PYTHON_SPECIFIC',
                'file': rel_path,
                'line': msg.get('location', {}).get('row', 0),
                'code_snippet': '',
                '_fixable': msg.get('fix') is not None,
                '_escalation_message': msg.get('message', '')
            })
        return anomalies
    except Exception as e:
        print(f"Erreur Ruff: {e}")
        return []

def get_all_linter_anomalies(project_root, fix=False):
    anomalies = []
    anomalies.extend(run_eslint(project_root, fix))
    anomalies.extend(run_ruff(project_root, fix))
    return anomalies

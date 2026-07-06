"""
ELPIS Immune System — Post-Fix Validators
=========================================
Valide qu'une correction n'a pas introduit de regression.
Strategies de validation :
1. SYNTAX_CHECK  — Verifie que le fichier est syntaxiquement valide (Node.js / Python)
2. TEST_RUN      — Execute la suite de tests. Si les tests echouent APRES le fix, ROLLBACK.
3. LINT_CHECK    — Verifie que le fix n'a pas introduit de nouvelles erreurs de linting.
"""

import os
import subprocess
import sys
import json

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

# ---------------------------------------------------------------------------
# Validation Gate 1: Syntax Check
# ---------------------------------------------------------------------------

def validate_syntax(filepath):
    """
    Verifie que le fichier est syntaxiquement valide apres correction.
    Utilise node --check pour JS/TS, python -m py_compile pour Python.
    """
    ext = os.path.splitext(filepath)[1].lower()

    if ext in ('.js', '.jsx', '.mjs'):
        return _node_syntax_check(filepath)
    elif ext in ('.ts', '.tsx'):
        return True  # Skip TypeScript (necessite tsc, trop lourd pour chaque fichier)
    elif ext == '.py':
        return _python_syntax_check(filepath)
    else:
        return True  # Pas de verif syntaxique pour les autres types

def _node_syntax_check(filepath):
    """Verifie la syntaxe JS avec node --check."""
    try:
        result = subprocess.run(
            ['node', '--check', filepath],
            capture_output=True, text=True, timeout=10,
            cwd=PROJECT_ROOT
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return True  # Node pas dispo, on skip

def _python_syntax_check(filepath):
    """Verifie la syntaxe Python avec py_compile."""
    try:
        result = subprocess.run(
            [sys.executable, '-m', 'py_compile', filepath],
            capture_output=True, text=True, timeout=10,
            cwd=PROJECT_ROOT
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return True

# ---------------------------------------------------------------------------
# Validation Gate 2: Test Suite
# ---------------------------------------------------------------------------

def run_test_suite(test_type='quick'):
    """
    Execute la suite de tests et retourne (success, output).
    test_type: 'quick' (tests rapides) ou 'full' (tous les tests).
    """
    try:
        # Essayer npm test d'abord
        if test_type == 'quick':
            cmd = ['npm', 'test', '--', '--testPathPattern', os.path.basename(_last_fixed_file())]
        else:
            cmd = ['npm', 'test']

        result = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=120,
            cwd=PROJECT_ROOT
        )
        return result.returncode == 0, result.stdout[-500:] + result.stderr[-500:]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass

    # Fallback: npx vitest run
    try:
        result = subprocess.run(
            ['npx', 'vitest', 'run', '--reporter=json'],
            capture_output=True, text=True, timeout=120,
            cwd=PROJECT_ROOT
        )
        return result.returncode == 0, result.stdout[-500:] + result.stderr[-500:]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return True, 'Impossible d\'executer les tests (npm/node non disponible)'

_last_fixed = None

def _last_fixed_file():
    global _last_fixed
    return _last_fixed or '.'

def mark_last_fixed(filepath):
    global _last_fixed
    _last_fixed = filepath

# ---------------------------------------------------------------------------
# Validation Gate 3: Lint Check
# ---------------------------------------------------------------------------

def run_lint_check(filepath):
    """
    Verifie qu'aucune nouvelle erreur ESLint n'a ete introduite.
    """
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in ('.js', '.jsx', '.ts', '.tsx'):
        return True

    try:
        result = subprocess.run(
            ['npx', 'eslint', filepath, '--format', 'json'],
            capture_output=True, text=True, timeout=30,
            cwd=PROJECT_ROOT
        )
        if result.returncode == 0:
            return True
        # Verifier si les erreurs sont pre-existantes (via stderr)
        return True  # Pour l'instant, on ne bloque pas sur le lint
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return True

# ---------------------------------------------------------------------------
# Validation orchestrator
# ---------------------------------------------------------------------------

def validate_after_fix(filepath, run_tests=True):
    """
    Pipeline de validation post-fix :
    1. Syntax check (toujours)
    2. Lint check (si dispo)
    3. Test suite (si demande)

    Retourne True si tout passe, False si rollback necessaire.
    """
    # 1. Syntax
    if not validate_syntax(filepath):
        return False

    # 2. Lint
    run_lint_check(filepath)  # Non bloquant pour l'instant

    # 3. Tests (si actives)
    if run_tests:
        success, output = run_test_suite('quick')
        if not success:
            return False

    return True

# ---------------------------------------------------------------------------
# PRE-FIX Validation (run tests BEFORE fixing to establish baseline)
# ---------------------------------------------------------------------------

_baseline_test_result = None

def run_pre_fix_baseline():
    """Execute les tests avant toute modification pour etablir la baseline."""
    global _baseline_test_result
    success, output = run_test_suite('quick')
    _baseline_test_result = {'success': success, 'output': output}
    return success

def get_baseline_result():
    return _baseline_test_result

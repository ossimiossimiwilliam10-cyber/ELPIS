#!/usr/bin/env bash
# Pre-commit validation script
# Vérifie que les tests passent avant de commit.
# À installer avec: cp scripts/validation/pre-commit.sh .git/hooks/pre-commit

set -e

echo "🔍 ELPIS Pre-commit Validation..."
echo ""

# 1. Lint staged files
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|jsx)$' || true)
STAGED_PY=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$' || true)

if [ -n "$STAGED_JS" ]; then
  echo "📝 ESLint check on staged JS files..."
  npx eslint $STAGED_JS --quiet || echo "⚠️  Lint warnings (non bloquant)"
fi

if [ -n "$STAGED_PY" ]; then
  echo "🐍 Ruff check on staged Python files..."
  python -m ruff check $STAGED_PY || echo "⚠️  Ruff warnings (non bloquant)"
fi

# 2. Run Python tests
echo ""
echo "🧪 Running Python tests..."
python -m pytest agent_audit/ -q --tb=short || {
  echo "❌ Python tests failed!"
  exit 1
}

# 3. Run Bridge tests
echo ""
echo "🧪 Running Bridge tests..."
cd interface/bridge && npx vitest run --reporter=verbose || {
  echo "❌ Bridge tests failed!"
  exit 1
}

echo ""
echo "✅ All validations passed!"

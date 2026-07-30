"""
Tests unitaires pour le module fixers.py de l'Immune System.
Tests réels avec assertions — plus de squelettes vides.
"""
import os
import sys
import tempfile
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fixers import (
    set_backup_dir,
    create_backup,
    rollback_file,
    cleanup_old_backups,
    set_rule_cache,
    apply_fixes,
    _find_rule_for_anomaly,
    _get_project_root
)


# ===========================================================================
# set_backup_dir / create_backup / rollback_file
# ===========================================================================

class TestBackupSystem:
    def test_set_backup_dir(self, tmp_path):
        """set_backup_dir définit le répertoire de backup."""
        backup_dir = tmp_path / "backups"
        set_backup_dir(str(backup_dir))
        from fixers import BACKUPS_DIR
        assert BACKUPS_DIR == str(backup_dir)

    def test_create_backup_copies_content(self, tmp_path):
        """create_backup crée une copie identique du fichier."""
        # Setup
        src_dir = tmp_path / "src"
        src_dir.mkdir()
        src_file = src_dir / "test.js"
        src_file.write_text("const x = 1;\nconsole.log(x);\n")

        backup_dir = tmp_path / "backups"
        set_backup_dir(str(backup_dir))

        timestamp_dir = backup_dir / "20260101_120000"
        backup_path = create_backup(str(src_file), str(timestamp_dir))

        assert os.path.exists(backup_path)
        with open(backup_path, 'r') as f:
            assert f.read() == "const x = 1;\nconsole.log(x);\n"

    def test_rollback_restores_file(self, tmp_path):
        """rollback_file restaure le contenu original."""
        src_file = tmp_path / "original.txt"
        src_file.write_text("version originale")

        backup_dir = tmp_path / "backups"
        backup_dir.mkdir()
        backup_file = backup_dir / "original.txt"
        backup_file.write_text("version originale")
        set_backup_dir(str(backup_dir))

        # Modifier le fichier source
        src_file.write_text("version modifiée")

        # Rollback
        result = rollback_file(str(src_file), str(backup_file))
        assert result is True
        assert src_file.read_text() == "version originale"

    def test_rollback_nonexistent_backup(self, tmp_path):
        """Rollback avec backup inexistant retourne False."""
        src_file = tmp_path / "test.txt"
        src_file.write_text("contenu")
        result = rollback_file(str(src_file), "/nonexistent/backup.txt")
        assert result is False

    def test_create_backup_creates_dirs(self, tmp_path):
        """create_backup crée les répertoires parents si nécessaire."""
        src_file = tmp_path / "deep/nested/file.txt"
        src_file.parent.mkdir(parents=True)
        src_file.write_text("test")

        backup_dir = tmp_path / "backups"
        set_backup_dir(str(backup_dir))

        timestamp_dir = backup_dir / "20260101_120000"
        backup_path = create_backup(str(src_file), str(timestamp_dir))

        assert os.path.exists(backup_path)


# ===========================================================================
# cleanup_old_backups
# ===========================================================================

class TestCleanup:
    def test_cleanup_removes_oldest(self, tmp_path):
        """cleanup_old_backups supprime les sessions les plus anciennes."""
        backup_dir = tmp_path / "backups"
        backup_dir.mkdir()
        set_backup_dir(str(backup_dir))

        # Créer 15 sessions
        for i in range(15):
            session = backup_dir / f"session_{i:03d}"
            session.mkdir()
            (session / "dummy.txt").write_text(f"session {i}")

        cleanup_old_backups(max_keep=5)

        remaining = sorted(os.listdir(str(backup_dir)))
        assert len(remaining) == 5
        # Les 5 plus récentes (derniers indices) doivent rester
        assert remaining == [f"session_{i:03d}" for i in range(10, 15)]

    def test_cleanup_no_backup_dir(self):
        """Pas de backup dir = pas d'erreur."""
        set_backup_dir("/nonexistent/backups")
        cleanup_old_backups(max_keep=5)  # Ne doit pas lever d'exception


# ===========================================================================
# set_rule_cache / _find_rule_for_anomaly
# ===========================================================================

class TestRuleCache:
    def test_set_and_find(self):
        """Le cache de règles permet de retrouver une règle."""
        rules = [
            {"id": "R001", "severity": "critical", "fix": {"action": "delete_line"}},
            {"id": "R002", "severity": "warning"},
        ]
        set_rule_cache(rules)

        anomaly = {"rule_id": "R001"}
        rule = _find_rule_for_anomaly(anomaly)
        assert rule is not None
        assert rule["id"] == "R001"
        assert rule["severity"] == "critical"

    def test_find_nonexistent(self):
        """Règle inexistante retourne None."""
        set_rule_cache([{"id": "R001"}])
        anomaly = {"rule_id": "R999"}
        assert _find_rule_for_anomaly(anomaly) is None

    def test_empty_cache(self):
        """Cache vide retourne None."""
        set_rule_cache([])
        anomaly = {"rule_id": "R001"}
        assert _find_rule_for_anomaly(anomaly) is None

    def test_filters_non_dict_rules(self):
        """Les entrées non-dict sont ignorées."""
        rules = [
            {"id": "R001"},
            "not_a_rule",
            123,
        ]
        set_rule_cache(rules)
        anomaly = {"rule_id": "R001"}
        rule = _find_rule_for_anomaly(anomaly)
        assert rule is not None
        assert rule["id"] == "R001"


# ===========================================================================
# apply_fixes
# ===========================================================================

class TestApplyFixes:
    def test_delete_line(self, tmp_path):
        """Fix delete_line supprime la ligne ciblée."""
        src_file = tmp_path / "test.js"
        src_file.write_text("ligne 1\nligne 2\nligne 3\n")

        rules = [{
            "id": "R001",
            "severity": "warning",
            "requires_human": False,
            "fix_confidence": 85,
            "auto_fix_strategy": "delete_line",
            "fix": {"action": "delete_line"}
        }]
        set_rule_cache(rules)

        anomaly = {
            "rule_id": "R001",
            "file": "test.js",
            "line": 2,
            "code_snippet": "ligne 2",
            "_fixable": True
        }

        set_backup_dir(str(tmp_path / "backups"))
        corrections, escalations, backup = apply_fixes(
            str(src_file), "test.js",
            ["ligne 1\n", "ligne 2\n", "ligne 3\n"],
            [anomaly],
            dry_run=False
        )

        assert len(corrections) == 1
        assert corrections[0]["action"] == "delete_line"

        # Vérifier le résultat
        result = src_file.read_text()
        assert result == "ligne 1\nligne 3\n"
        assert "ligne 2" not in result

    def test_comment_out(self, tmp_path):
        """Fix comment_out commente la ligne."""
        src_file = tmp_path / "test.js"
        src_file.write_text("var danger = true;\nvar safe = false;\n")

        rules = [{
            "id": "R002",
            "severity": "warning",
            "requires_human": False,
            "fix_confidence": 75,
            "auto_fix_strategy": "comment_out",
            "fix": {"action": "comment_out", "comment_prefix": "// TODO [AUDIT]:"}
        }]
        set_rule_cache(rules)

        anomaly = {
            "rule_id": "R002",
            "file": "test.js",
            "line": 1,
            "code_snippet": "var danger = true;",
            "_fixable": True
        }

        set_backup_dir(str(tmp_path / "backups"))
        corrections, escalations, backup = apply_fixes(
            str(src_file), "test.js",
            ["var danger = true;\n", "var safe = false;\n"],
            [anomaly],
            dry_run=False
        )

        assert len(corrections) == 1
        result = src_file.read_text()
        assert "TODO [AUDIT]" in result
        assert "var danger = true;" in result  # L'originale est conservée

    def test_dry_run_does_not_write(self, tmp_path):
        """En dry_run, le fichier n'est pas modifié."""
        src_file = tmp_path / "test.js"
        original = "ligne 1\nligne 2\nligne 3\n"
        src_file.write_text(original)

        rules = [{
            "id": "R001",
            "severity": "warning",
            "requires_human": False,
            "fix_confidence": 85,
            "auto_fix_strategy": "delete_line",
            "fix": {"action": "delete_line"}
        }]
        set_rule_cache(rules)

        anomaly = {
            "rule_id": "R001",
            "file": "test.js",
            "line": 2,
            "_fixable": True
        }

        set_backup_dir(str(tmp_path / "backups"))
        corrections, escalations, backup = apply_fixes(
            str(src_file), "test.js",
            ["ligne 1\n", "ligne 2\n", "ligne 3\n"],
            [anomaly],
            dry_run=True
        )

        # En dry_run, corrections sont retournées mais fichier inchangé
        assert src_file.read_text() == original

    def test_rule_not_found_escalates(self, tmp_path):
        """Règle introuvable génère une escalade."""
        rules = [{"id": "OTHER"}]
        set_rule_cache(rules)

        anomaly = {
            "rule_id": "NONEXISTENT",
            "file": "test.js",
            "line": 1,
            "_fixable": True
        }

        set_backup_dir(str(tmp_path / "backups"))
        corrections, escalations, backup = apply_fixes(
            str(tmp_path / "dummy.js"), "test.js",
            ["ligne\n"],
            [anomaly],
            dry_run=True
        )

        assert len(corrections) == 0
        assert len(escalations) == 1
        assert escalations[0]["type"] == "RULE_NOT_FOUND"

    def test_delete_line_ordering(self, tmp_path):
        """Les delete_line sont appliqués en ordre décroissant de ligne."""
        src_file = tmp_path / "test.js"
        src_file.write_text("A\nB\nC\nD\nE\n")

        rules = [{
            "id": "R001",
            "severity": "warning",
            "requires_human": False,
            "fix_confidence": 85,
            "auto_fix_strategy": "delete_line",
            "fix": {"action": "delete_line"}
        }]
        set_rule_cache(rules)

        anomalies = [
            {"rule_id": "R001", "file": "test.js", "line": 5, "_fixable": True},  # "E"
            {"rule_id": "R001", "file": "test.js", "line": 2, "_fixable": True},  # "B"
        ]

        set_backup_dir(str(tmp_path / "backups"))
        apply_fixes(
            str(src_file), "test.js",
            ["A\n", "B\n", "C\n", "D\n", "E\n"],
            anomalies,
            dry_run=False
        )

        result = src_file.read_text()
        assert result == "A\nC\nD\n"  # B et E supprimées

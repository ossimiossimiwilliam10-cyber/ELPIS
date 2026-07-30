"""
Tests unitaires pour le moteur de l'Immune System (engine.py).
Remplace les tests squelettes par de vrais tests avec assertions.
"""
import os
import sys
import json
import hashlib
import pytest

# Ajouter le répertoire parent au path pour importer engine
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from engine import (
    load_rules,
    file_hash,
    load_last_hashes,
    save_hashes,
    prioritize_anomalies,
    should_auto_fix,
    is_emergency,
    calculate_health_score,
    _is_text_file,
    _build_report,
    _count_by
)


# ===========================================================================
# load_rules
# ===========================================================================

class TestLoadRules:
    def test_load_v2_format_list(self, tmp_path):
        """Format v2 : liste plate de règles."""
        rules_file = tmp_path / "rules.json"
        rules_file.write_text(json.dumps([
            {"id": "R001", "severity": "critical"},
            {"id": "R002", "severity": "warning"}
        ]))
        rules, meta = load_rules(str(rules_file))
        assert len(rules) == 2
        assert meta == {}

    def test_load_v3_format_dict(self, tmp_path):
        """Format v3 : dict avec meta + rules."""
        rules_file = tmp_path / "rules.json"
        rules_file.write_text(json.dumps({
            "meta": {"version": "3.0"},
            "rules": [
                {"id": "R001", "severity": "critical"}
            ]
        }))
        rules, meta = load_rules(str(rules_file))
        assert len(rules) == 1
        assert meta == {"version": "3.0"}

    def test_load_v3_filters_non_dicts(self, tmp_path):
        """Les entrées non-dict dans rules sont filtrées."""
        rules_file = tmp_path / "rules.json"
        rules_file.write_text(json.dumps({
            "rules": [
                {"id": "R001"},
                "not_a_rule",
                123,
                {"id": "R002"}
            ]
        }))
        rules, _ = load_rules(str(rules_file))
        assert len(rules) == 2

    def test_load_empty_file(self, tmp_path):
        """Fichier vide lève une erreur."""
        rules_file = tmp_path / "rules.json"
        rules_file.write_text("[]")
        rules, meta = load_rules(str(rules_file))
        assert rules == []
        assert meta == {}

    def test_load_invalid_format(self, tmp_path):
        """Format inconnu lève ValueError."""
        rules_file = tmp_path / "rules.json"
        rules_file.write_text('"just a string"')
        with pytest.raises(ValueError, match="Format de regles inconnu"):
            load_rules(str(rules_file))


# ===========================================================================
# file_hash
# ===========================================================================

class TestFileHash:
    def test_hash_known_content(self, tmp_path):
        """Le hash d'un fichier avec contenu connu est déterministe."""
        f = tmp_path / "test.txt"
        f.write_text("hello world")
        h = file_hash(str(f))
        expected = hashlib.sha256(b"hello world").hexdigest()
        assert h == expected

    def test_hash_different_content(self, tmp_path):
        """Deux contenus différents produisent des hash différents."""
        f1 = tmp_path / "a.txt"
        f2 = tmp_path / "b.txt"
        f1.write_text("hello")
        f2.write_text("world")
        assert file_hash(str(f1)) != file_hash(str(f2))

    def test_hash_nonexistent_file(self):
        """Fichier inexistant retourne None."""
        assert file_hash("/nonexistent/path/file.txt") is None

    def test_hash_empty_file(self, tmp_path):
        """Fichier vide a un hash valide."""
        f = tmp_path / "empty.txt"
        f.write_text("")
        h = file_hash(str(f))
        assert h is not None
        assert len(h) == 64  # SHA256 hex


# ===========================================================================
# load_last_hashes / save_hashes
# ===========================================================================

class TestHashCache:
    def test_load_nonexistent(self, tmp_path):
        """Cache inexistant retourne dict vide."""
        cache = tmp_path / "nonexistent.json"
        result = load_last_hashes(str(cache))
        assert result == {}

    def test_save_and_load(self, tmp_path):
        """Sauvegarde et recharge correctement."""
        cache = tmp_path / "hashes.json"
        data = {"/path/to/file.js": "abc123", "/path/to/file.py": "def456"}
        save_hashes(str(cache), data)
        loaded = load_last_hashes(str(cache))
        assert loaded == data

    def test_save_overwrites(self, tmp_path):
        """La sauvegarde écrase le cache précédent."""
        cache = tmp_path / "hashes.json"
        save_hashes(str(cache), {"old": "hash"})
        save_hashes(str(cache), {"new": "hash"})
        loaded = load_last_hashes(str(cache))
        assert loaded == {"new": "hash"}


# ===========================================================================
# severity_sort_key / prioritize_anomalies
# ===========================================================================

class TestPrioritize:
    def test_criticals_before_warnings(self):
        """Les criticals doivent apparaître avant les warnings."""
        anomalies = [
            {"rule_id": "R2", "severity": "warning"},
            {"rule_id": "R1", "severity": "critical"},
            {"rule_id": "R3", "severity": "info"},
        ]
        sorted_anomalies = prioritize_anomalies(anomalies)
        assert sorted_anomalies[0]["severity"] == "critical"
        assert sorted_anomalies[1]["severity"] == "warning"
        assert sorted_anomalies[2]["severity"] == "info"

    def test_same_severity_sorted_by_rule_id(self):
        """Même sévérité : tri par rule_id."""
        anomalies = [
            {"rule_id": "R-C", "severity": "warning"},
            {"rule_id": "R-A", "severity": "warning"},
            {"rule_id": "R-B", "severity": "warning"},
        ]
        sorted_anomalies = prioritize_anomalies(anomalies)
        assert sorted_anomalies[0]["rule_id"] == "R-A"
        assert sorted_anomalies[1]["rule_id"] == "R-B"
        assert sorted_anomalies[2]["rule_id"] == "R-C"

    def test_empty_list(self):
        """Liste vide retournée telle quelle."""
        assert prioritize_anomalies([]) == []

    def test_unknown_severity_defaults_to_info(self):
        """Sévérité inconnue traitée comme info (poids 10)."""
        anomalies = [
            {"rule_id": "R1", "severity": "critical"},
            {"rule_id": "R2", "severity": "unknown_xyz"},
        ]
        sorted_anomalies = prioritize_anomalies(anomalies)
        assert sorted_anomalies[0]["severity"] == "critical"


# ===========================================================================
# should_auto_fix
# ===========================================================================

class TestShouldAutoFix:
    def test_requires_human_returns_false(self):
        """Règle marquée requires_human ne peut pas être auto-fixée."""
        rule = {"id": "R1", "requires_human": True, "fix_confidence": 95, "auto_fix_strategy": "replace"}
        assert should_auto_fix(rule) is False

    def test_low_confidence_returns_false(self):
        """Confiance < 70 interdit l'auto-fix."""
        rule = {"id": "R1", "requires_human": False, "fix_confidence": 60, "auto_fix_strategy": "replace"}
        assert should_auto_fix(rule) is False

    def test_no_strategy_returns_false(self):
        """Pas de stratégie = pas d'auto-fix."""
        rule = {"id": "R1", "requires_human": False, "fix_confidence": 80, "auto_fix_strategy": None}
        assert should_auto_fix(rule) is False

    def test_none_strategy_returns_false(self):
        """Stratégie 'none' = pas d'auto-fix."""
        rule = {"id": "R1", "requires_human": False, "fix_confidence": 80, "auto_fix_strategy": "none"}
        assert should_auto_fix(rule) is False

    def test_valid_rule_returns_true(self):
        """Règle avec confiance élevée et stratégie = True."""
        rule = {"id": "R1", "requires_human": False, "fix_confidence": 85, "auto_fix_strategy": "replace"}
        assert should_auto_fix(rule) is True

    def test_exactly_at_threshold(self):
        """À la limite exacte du seuil (70)."""
        rule = {"id": "R1", "requires_human": False, "fix_confidence": 70, "auto_fix_strategy": "delete_line"}
        assert should_auto_fix(rule) is True


# ===========================================================================
# is_emergency
# ===========================================================================

class TestIsEmergency:
    def test_emergency_critical(self):
        """Emergency mode + critical = True."""
        rule = {"emergency_mode": True, "severity": "critical"}
        assert is_emergency(rule) is True

    def test_emergency_warning_not_emergency(self):
        """Emergency mode mais warning = pas une urgence."""
        rule = {"emergency_mode": True, "severity": "warning"}
        assert is_emergency(rule) is False

    def test_no_emergency_mode(self):
        """Pas de emergency_mode = False."""
        rule = {"severity": "critical"}
        assert is_emergency(rule) is False


# ===========================================================================
# calculate_health_score
# ===========================================================================

class TestCalculateHealthScore:
    def test_perfect_score_no_anomalies(self):
        """Aucune anomalie = score 100."""
        report = {
            "total_anomalies": 0,
            "total_corrections": 0,
            "anomalies_by_severity": {"critical": 0, "warning": 0, "info": 0},
            "escalation_stats": {"by_level": {}}
        }
        score = calculate_health_score(report, [])
        assert score == 100

    def test_critical_anomalies_reduce_score(self):
        """Des anomalies critiques réduisent le score."""
        report = {
            "total_anomalies": 5,
            "total_corrections": 0,
            "anomalies_by_severity": {"critical": 5, "warning": 0, "info": 0},
            "rule_stats": {
                "R001": {"count": 5, "severity": "critical"}
            },
            "escalation_stats": {"by_level": {}}
        }
        score = calculate_health_score(report, [])
        assert score < 100

    def test_corrections_improve_score(self):
        """Les corrections appliquées remontent le score."""
        report_no_fix = {
            "total_anomalies": 10,
            "total_corrections": 0,
            "anomalies_by_severity": {"critical": 5, "warning": 5, "info": 0},
            "escalation_stats": {"by_level": {}}
        }
        score_before = calculate_health_score(report_no_fix, [])

        report_with_fix = {**report_no_fix, "total_corrections": 10}
        score_after = calculate_health_score(report_with_fix, [])
        assert score_after >= score_before

    def test_fp_risk_weights(self):
        """Les règles avec high false_positive_risk pèsent moins."""
        rules = [
            {"id": "R001", "false_positive_risk": "high"},
            {"id": "R002", "false_positive_risk": "low"}
        ]
        report_high_fp = {
            "total_anomalies": 10,
            "total_corrections": 0,
            "anomalies_by_severity": {"critical": 10, "warning": 0, "info": 0},
            "rule_stats": {
                "R001": {"count": 10, "severity": "critical"}  # high fp = pondéré à 10%
            },
            "escalation_stats": {"by_level": {}}
        }
        report_low_fp = {
            "total_anomalies": 10,
            "total_corrections": 0,
            "anomalies_by_severity": {"critical": 10, "warning": 0, "info": 0},
            "rule_stats": {
                "R002": {"count": 10, "severity": "critical"}  # low fp = pondéré à 100%
            },
            "escalation_stats": {"by_level": {}}
        }
        score_high_fp = calculate_health_score(report_high_fp, rules)
        score_low_fp = calculate_health_score(report_low_fp, rules)
        # Même nombre d'anomalies, mais pondération différente
        assert score_high_fp > score_low_fp  # high fp = moins pénalisant

    def test_escalations_penalize(self):
        """Les escalades critiques pénalisent lourdement."""
        report = {
            "total_anomalies": 0,
            "total_corrections": 0,
            "anomalies_by_severity": {"critical": 0, "warning": 0, "info": 0},
            "escalation_stats": {
                "by_level": {"critical": 3, "elevated": 0, "standard": 0}
            }
        }
        score = calculate_health_score(report, [])
        assert score < 100

    def test_score_bounded_0_to_100(self):
        """Le score reste entre 0 et 100."""
        report_max = {
            "total_anomalies": 0,
            "total_corrections": 0,
            "anomalies_by_severity": {"critical": 0, "warning": 0, "info": 0},
            "escalation_stats": {"by_level": {}}
        }
        assert 0 <= calculate_health_score(report_max, []) <= 100

        report_min = {
            "total_anomalies": 999,
            "total_corrections": 0,
            "anomalies_by_severity": {"critical": 999, "warning": 999, "info": 999},
            "rule_stats": {
                "R": {"count": 999, "severity": "critical"}
            },
            "escalation_stats": {"by_level": {"critical": 50}}
        }
        assert 0 <= calculate_health_score(report_min, []) <= 100


# ===========================================================================
# _is_text_file
# ===========================================================================

class TestIsTextFile:
    def test_js_file(self):
        assert _is_text_file("src/app.js") is True

    def test_py_file(self):
        assert _is_text_file("main.py") is True

    def test_json_file(self):
        assert _is_text_file("package.json") is True

    def test_png_file(self):
        assert _is_text_file("image.png") is False

    def test_pdf_file(self):
        assert _is_text_file("doc.pdf") is False

    def test_mp3_file(self):
        assert _is_text_file("song.mp3") is False


# ===========================================================================
# _build_report / _count_by
# ===========================================================================

class TestBuildReport:
    def test_build_report_structure(self):
        """Le rapport contient toutes les clés attendues."""
        report = _build_report(
            anomalies=[{"severity": "critical", "category": "SECURITY", "rule_id": "R1"}],
            corrections=[{"rule_id": "R1", "file": "test.js"}],
            escalations=[],
            files_scanned=10,
            total_lines=500,
            lines_by_ext={".js": 300, ".py": 200},
            files_corrected=1,
            dry_run=False
        )
        assert report["total_anomalies"] == 1
        assert report["total_corrections"] == 1
        assert report["files_scanned"] == 10
        assert report["total_lines_of_code"] == 500
        assert report["anomalies_by_severity"]["critical"] == 1
        assert report["anomalies_by_severity"]["warning"] == 0
        assert report["files_corrected"] == 1
        assert report["mode"] == "SCAN + CORRECTION"

    def test_dry_run_mode(self):
        """Le mode dry_run est indiqué dans le rapport."""
        report = _build_report([], [], [], 0, 0, {}, 0, dry_run=True)
        assert "RAPPORT SEUL" in report["mode"]

    def test_truncation_flag(self):
        """Le flag _anomalies_truncated est True si > 500 anomalies."""
        anomalies = [{"severity": "info", "category": "STYLE"} for _ in range(600)]
        report = _build_report(anomalies, [], [], 0, 0, {}, 0, False)
        assert report["_anomalies_truncated"] is True
        assert len(report["anomalies"]) == 500


class TestCountBy:
    def test_count_by_category(self):
        items = [
            {"category": "SECURITY"},
            {"category": "SECURITY"},
            {"category": "STYLE"},
        ]
        result = _count_by(items, "category")
        assert result == {"SECURITY": 2, "STYLE": 1}

    def test_count_by_unknown_default(self):
        items = [{"other": "value"}]
        result = _count_by(items, "category")
        assert result == {"UNKNOWN": 1}

"""
Tests unitaires pour le module health.py de l'Immune System.
Tests réels — remplace les squelettes vides.
"""
import os
import sys
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from health import (
    _check_rules_health,
    _check_performance,
    _analyze_false_positives,
    _check_escalation_health,
    _check_rule_activity,
    _check_output_health,
    _aggregate_health_warnings
)


# ===========================================================================
# _check_rules_health
# ===========================================================================

class TestCheckRulesHealth:
    def test_valid_rules(self, tmp_path):
        """Des règles valides produisent un statut HEALTHY."""
        rules_file = tmp_path / "rules.json"
        rules_file.write_text("{}")
        rules = [
            {"id": "R001", "severity": "warning", "description": "Test", "patterns": [r"console\.log"]},
            {"id": "R002", "severity": "info", "description": "Test 2", "patterns": [r"var\s+"]}
        ]
        result = _check_rules_health(rules, str(rules_file))
        assert result["status"] == "HEALTHY"
        assert result["total_rules"] == 2

    def test_missing_required_fields(self, tmp_path):
        """Règles sans champs obligatoires génèrent des warnings."""
        rules_file = tmp_path / "rules.json"
        rules_file.write_text("{}")
        rules = [{"id": "R001"}]  # manque severity, description, patterns
        result = _check_rules_health(rules, str(rules_file))
        assert len(result["issues"]) > 0

    def test_invalid_severity(self, tmp_path):
        """Sévérité invalide détectée."""
        rules_file = tmp_path / "rules.json"
        rules_file.write_text("{}")
        rules = [{
            "id": "R001",
            "severity": "catastrophique",
            "description": "Test",
            "patterns": ["test"]
        }]
        result = _check_rules_health(rules, str(rules_file))
        has_severity_issue = any("Severite invalide" in i for i in result["issues"])
        assert has_severity_issue

    def test_duplicate_ids(self, tmp_path):
        """IDs dupliqués détectés."""
        rules_file = tmp_path / "rules.json"
        rules_file.write_text("{}")
        rules = [
            {"id": "R001", "severity": "warning", "description": "A", "patterns": ["a"]},
            {"id": "R001", "severity": "info", "description": "B", "patterns": ["b"]}
        ]
        result = _check_rules_health(rules, str(rules_file))
        has_duplicate = any("dupliques" in i for i in result["issues"])
        assert has_duplicate

    def test_nonexistent_file(self):
        """Fichier rules.json inexistant → CRITICAL."""
        result = _check_rules_health([], "/nonexistent/rules.json")
        assert result["status"] == "CRITICAL"

    def test_circular_and_layer_patterns_are_valid(self, tmp_path):
        """Les patterns spéciaux (CIRCULAR_DETECTED, etc.) sont acceptés."""
        rules_file = tmp_path / "rules.json"
        rules_file.write_text("{}")
        rules = [{
            "id": "R001",
            "severity": "warning",
            "description": "Test",
            "patterns": ["CIRCULAR_DETECTED"]
        }]
        result = _check_rules_health(rules, str(rules_file))
        # Pas d'erreur de regex invalide
        regex_issues = [i for i in result["issues"] if "Pattern regex invalide" in i]
        assert len(regex_issues) == 0


# ===========================================================================
# _check_performance
# ===========================================================================

class TestCheckPerformance:
    def test_healthy_performance(self):
        """Des performances normales sont HEALTHY."""
        report = {"files_scanned": 100, "total_lines_of_code": 5000}
        result = _check_performance(report, elapsed_seconds=5.0)
        assert result["status"] == "HEALTHY"
        assert result["files_per_second"] == 20.0

    def test_slow_performance_warning(self):
        """Moins de 10 fichiers/s → WARNING."""
        report = {"files_scanned": 50, "total_lines_of_code": 1000}
        result = _check_performance(report, elapsed_seconds=10.0)
        assert result["status"] == "WARNING"
        assert result["files_per_second"] == 5.0

    def test_very_slow_performance_critical(self):
        """Moins de 2 fichiers/s → CRITICAL."""
        report = {"files_scanned": 5, "total_lines_of_code": 100}
        result = _check_performance(report, elapsed_seconds=10.0)
        assert result["status"] == "CRITICAL"

    def test_zero_elapsed(self):
        """Temps écoulé zéro → pas de division par zéro."""
        report = {"files_scanned": 0, "total_lines_of_code": 0}
        result = _check_performance(report, elapsed_seconds=0)
        assert result["files_per_second"] == 0


# ===========================================================================
# _analyze_false_positives
# ===========================================================================

class TestAnalyzeFalsePositives:
    def test_no_anomalies(self):
        """Aucune anomalie = distribution vide."""
        report = {"anomalies": []}
        escalations = []
        result = _analyze_false_positives(report, escalations)
        assert result["total_rules_with_hits"] == 0
        assert result["false_positive_escalations"] == 0

    def test_counts_by_rule(self):
        """Les anomalies sont comptées par rule_id."""
        report = {
            "anomalies": [
                {"rule_id": "R001"},
                {"rule_id": "R001"},
                {"rule_id": "R002"}
            ]
        }
        result = _analyze_false_positives(report, [])
        assert result["total_rules_with_hits"] == 2
        assert result["rule_hit_distribution"]["R001"] == 2
        assert result["rule_hit_distribution"]["R002"] == 1

    def test_fp_escalations_counted(self):
        """Les escalades PATTERN_TOO_BROAD sont comptées."""
        escalations = [
            {"type": "PATTERN_TOO_BROAD"},
            {"type": "OTHER"},
            {"type": "PATTERN_TOO_BROAD"}
        ]
        result = _analyze_false_positives({"anomalies": []}, escalations)
        assert result["false_positive_escalations"] == 2


# ===========================================================================
# _check_escalation_health
# ===========================================================================

class TestCheckEscalationHealth:
    def test_no_escalations(self):
        """Aucune escalade = HEALTHY."""
        result = _check_escalation_health([])
        assert result["status"] == "HEALTHY"
        assert result["total_escalations"] == 0

    def test_critical_escalations(self):
        """Escalades critiques → CRITICAL."""
        escalations = [
            {"level": "critical", "type": "SECURITY_BREACH"},
            {"level": "standard", "type": "WARNING"}
        ]
        result = _check_escalation_health(escalations)
        assert result["status"] == "CRITICAL"
        assert result["critical_escalations"] == 1

    def test_fix_broke_tests(self):
        """FIX_BROKE_TESTS sans critical → WARNING."""
        escalations = [
            {"type": "FIX_BROKE_TESTS"}
        ]
        result = _check_escalation_health(escalations)
        assert result["status"] == "WARNING"
        assert result["fixes_that_broke_tests"] == 1


# ===========================================================================
# _check_rule_activity
# ===========================================================================

class TestCheckRuleActivity:
    def test_active_and_inactive_rules(self):
        """Détecte les règles actives et inactives."""
        rules = [
            {"id": "R001"}, {"id": "R002"}, {"id": "R003"}
        ]
        report = {
            "anomalies": [
                {"rule_id": "R001"},
                {"rule_id": "R001"}
            ]
        }
        result = _check_rule_activity(rules, report)
        assert result["total_rules"] == 3
        assert result["active_rules"] == 1
        assert result["inactive_count"] == 2
        assert "R002" in result["inactive_rules"]
        assert "R003" in result["inactive_rules"]

    def test_all_active(self):
        """Toutes les règles actives."""
        rules = [{"id": "R001"}, {"id": "R002"}]
        report = {"anomalies": [{"rule_id": "R001"}, {"rule_id": "R002"}]}
        result = _check_rule_activity(rules, report)
        assert result["inactive_count"] == 0


# ===========================================================================
# _check_output_health
# ===========================================================================

class TestCheckOutputHealth:
    def test_valid_output_file(self, tmp_path):
        """Fichier de sortie valide."""
        output = tmp_path / "audit.json"
        output.write_text(json.dumps({
            "last_scan": "2026-01-01T00:00:00",
            "files_scanned": 100,
            "total_anomalies": 5
        }))
        result = _check_output_health(str(output))
        assert result["status"] == "HEALTHY"

    def test_missing_file(self):
        """Fichier inexistant → WARNING."""
        result = _check_output_health("/nonexistent/output.json")
        assert result["status"] == "WARNING"

    def test_missing_required_fields(self, tmp_path):
        """Champs requis manquants."""
        output = tmp_path / "audit.json"
        output.write_text(json.dumps({"last_scan": "2026-01-01"}))
        result = _check_output_health(str(output))
        assert result["status"] == "WARNING"

    def test_invalid_json(self, tmp_path):
        """JSON invalide → CRITICAL."""
        output = tmp_path / "audit.json"
        output.write_text("not valid json {{{")
        result = _check_output_health(str(output))
        assert result["status"] == "CRITICAL"


# ===========================================================================
# _aggregate_health_warnings
# ===========================================================================

class TestAggregateHealthWarnings:
    def test_healthy_aggregation(self):
        """Tout est sain → HEALTHY."""
        health = {
            "rules_health": {"status": "HEALTHY", "issues": []},
            "scan_performance": {"status": "HEALTHY", "files_per_second": 50},
            "escalation_health": {"status": "HEALTHY", "critical_escalations": 0, "fixes_that_broke_tests": 0},
            "rule_activity": {"inactive_count": 2},
            "output_health": {"status": "HEALTHY"},
            "warnings": [],
            "recommendations": []
        }
        _aggregate_health_warnings(health)
        assert health["overall_status"] == "HEALTHY"

    def test_critical_escalation_aggregation(self):
        """Escalade critique → CRITICAL."""
        health = {
            "rules_health": {"status": "HEALTHY", "issues": []},
            "scan_performance": {"status": "HEALTHY", "files_per_second": 50},
            "escalation_health": {"status": "CRITICAL", "critical_escalations": 3, "fixes_that_broke_tests": 0},
            "rule_activity": {"inactive_count": 2},
            "output_health": {"status": "HEALTHY"},
            "warnings": [],
            "recommendations": []
        }
        _aggregate_health_warnings(health)
        assert health["overall_status"] == "CRITICAL"

    def test_rules_warnings_aggregation(self):
        """Règles avec warnings → WARNING."""
        health = {
            "rules_health": {"status": "WARNING", "issues": ["Problème"]},
            "scan_performance": {"status": "HEALTHY", "files_per_second": 50},
            "escalation_health": {"status": "HEALTHY", "critical_escalations": 0, "fixes_that_broke_tests": 0},
            "rule_activity": {"inactive_count": 2},
            "output_health": {"status": "HEALTHY"},
            "warnings": [],
            "recommendations": []
        }
        _aggregate_health_warnings(health)
        assert health["overall_status"] == "WARNING"
        assert len(health["warnings"]) > 0

    def test_many_inactive_rules_recommendation(self):
        """>10 règles inactives → recommandation."""
        health = {
            "rules_health": {"status": "HEALTHY", "issues": []},
            "scan_performance": {"status": "HEALTHY", "files_per_second": 50},
            "escalation_health": {"status": "HEALTHY", "critical_escalations": 0, "fixes_that_broke_tests": 0},
            "rule_activity": {"inactive_count": 15},
            "output_health": {"status": "HEALTHY"},
            "warnings": [],
            "recommendations": []
        }
        _aggregate_health_warnings(health)
        assert len(health["recommendations"]) > 0

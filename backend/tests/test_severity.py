"""
Test: Severity Model
=====================
Tests run_severity() function and rule-based fallback.
Place at: backend/tests/test_severity.py

Run: pytest tests/test_severity.py -v
"""

import numpy as np
import pytest
from app.models.severity import run_severity, _rule_based_severity


class TestRuleBasedSeverity:

    def test_zero_damage_is_low(self):
        """0% damage should be low severity."""
        features = np.array([0.0, 0.0, 0.0, 0.0, 0.0])
        label, conf, score = _rule_based_severity(features)
        assert label == "low"

    def test_high_damage_is_high(self):
        """50% damage should be high severity."""
        features = np.array([0.50, 5000.0, 0.0, 0.0, 0.0])
        label, conf, score = _rule_based_severity(features)
        assert label == "high"

    def test_medium_damage_is_medium(self):
        """20% damage should be medium severity."""
        features = np.array([0.20, 2000.0, 0.0, 0.0, 0.0])
        label, conf, score = _rule_based_severity(features)
        assert label == "medium"

    def test_returns_three_values(self):
        """Function must return exactly 3 values."""
        features = np.array([0.1, 500.0, 0.0, 0.0, 0.0])
        result   = _rule_based_severity(features)
        assert len(result) == 3

    def test_score_is_between_0_and_100(self):
        """Score must always be between 0 and 100."""
        for damage_ratio in [0.0, 0.05, 0.15, 0.40, 0.80, 1.0]:
            features = np.array([damage_ratio, 0.0, 0.0, 0.0, 0.0])
            _, _, score = _rule_based_severity(features)
            assert 0.0 <= score <= 100.0, f"Score {score} out of range for ratio {damage_ratio}"

    def test_confidence_between_0_and_1(self):
        """Confidence must be between 0 and 1."""
        features = np.array([0.05, 500.0, 0.0, 0.0, 0.0])
        _, conf, _ = _rule_based_severity(features)
        assert 0.0 <= conf <= 1.0

    def test_higher_damage_gives_higher_score(self):
        """Higher damage ratio should give higher score."""
        f_low  = np.array([0.02, 0.0, 0.0, 0.0, 0.0])
        f_high = np.array([0.50, 0.0, 0.0, 0.0, 0.0])
        _, _, score_low  = _rule_based_severity(f_low)
        _, _, score_high = _rule_based_severity(f_high)
        assert score_high > score_low


class TestRunSeverity:

    def test_run_severity_returns_three_values(self):
        """run_severity must return exactly 3 values."""
        features = np.array([0.05, 500.0, 0.01, 2.0, 0.1])
        result   = run_severity(features)
        assert len(result) == 3

    def test_run_severity_label_valid(self):
        """Severity label must be low, medium, or high."""
        features = np.array([0.05, 500.0, 0.01, 2.0, 0.1])
        label, _, _ = run_severity(features)
        assert label in ["low", "medium", "high"]

    def test_run_severity_score_in_range(self):
        """Score from run_severity must be 0-100."""
        features = np.array([0.05, 500.0, 0.01, 2.0, 0.1])
        _, _, score = run_severity(features)
        assert 0.0 <= score <= 100.0

    def test_run_severity_confidence_in_range(self):
        """Confidence from run_severity must be 0-1."""
        features = np.array([0.05, 500.0, 0.01, 2.0, 0.1])
        _, conf, _ = run_severity(features)
        assert 0.0 <= conf <= 1.0

    def test_run_severity_handles_zero_features(self):
        """Zero feature vector should not crash."""
        features = np.array([0.0, 0.0, 0.0, 0.0, 0.0])
        label, conf, score = run_severity(features)
        assert label in ["low", "medium", "high"]

    def test_run_severity_handles_max_features(self):
        """Maximum damage features should not crash."""
        features = np.array([1.0, 50176.0, 1.0, 100.0, 1.0])
        label, conf, score = run_severity(features)
        assert label == "high"
        assert 0.0 <= score <= 100.0

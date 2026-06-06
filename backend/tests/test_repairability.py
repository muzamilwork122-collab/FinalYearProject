"""
Test: Repairability Assessment
================================
Tests assess_repairability() function.
Place at: backend/tests/test_repairability.py

Run: pytest tests/test_repairability.py -v
"""

import numpy as np
import pytest
from app.services.validation import assess_repairability


class TestAssessRepairability:

    def test_returns_dict(self):
        """Must return a dictionary."""
        result = assess_repairability(50.0, "medium")
        assert isinstance(result, dict)

    def test_result_has_required_keys(self):
        """Result must have all required keys."""
        result   = assess_repairability(50.0, "medium")
        required = ["repairable", "status", "recommendation",
                    "reason", "repair_advice"]
        for key in required:
            assert key in result, f"Missing key: {key}"

    def test_low_damage_is_repairable(self):
        """Low damage score should be repairable."""
        result = assess_repairability(20.0, "low")
        assert result["repairable"] is True
        assert result["status"]     == "repairable"

    def test_critical_damage_not_repairable(self):
        """Score above 85 should be not repairable."""
        result = assess_repairability(90.0, "high")
        assert result["repairable"] is False
        assert result["status"]     == "not_repairable"

    def test_borderline_damage_is_borderline(self):
        """Score between 65 and 85 should be borderline."""
        result = assess_repairability(70.0, "high")
        assert result["repairable"] is True
        assert result["status"]     == "borderline"

    def test_repairable_is_boolean(self):
        """Repairable field must be a boolean."""
        result = assess_repairability(30.0, "low")
        assert isinstance(result["repairable"], bool)

    def test_recommendation_is_string(self):
        """Recommendation must be a non-empty string."""
        result = assess_repairability(50.0, "medium")
        assert isinstance(result["recommendation"], str)
        assert len(result["recommendation"]) > 0

    def test_repair_advice_is_string(self):
        """Repair advice must be a non-empty string."""
        result = assess_repairability(50.0, "medium")
        assert isinstance(result["repair_advice"], str)
        assert len(result["repair_advice"]) > 0

    def test_status_valid_values(self):
        """Status must be one of three valid values."""
        valid = ["repairable", "borderline", "not_repairable"]
        for score, severity in [(10,"low"),(50,"medium"),(90,"high")]:
            result = assess_repairability(float(score), severity)
            assert result["status"] in valid

    def test_zero_damage_is_repairable(self):
        """Zero damage should always be repairable."""
        result = assess_repairability(0.0, "low")
        assert result["repairable"] is True

    def test_dead_lcd_not_repairable(self):
        """When mask shows >60% dark (dead LCD), should not be repairable."""
        dead_mask = np.zeros((224, 224), dtype=np.float32)
        result    = assess_repairability(30.0, "medium", mask=dead_mask)
        assert result["repairable"] is False
        assert "dead" in result["reason"].lower() or \
               "lcd"  in result["reason"].lower() or \
               "dark" in result["reason"].lower()

    def test_with_none_mask_does_not_crash(self):
        """Passing None as mask should not crash."""
        result = assess_repairability(50.0, "medium", mask=None)
        assert result is not None

    def test_higher_damage_gives_worse_status(self):
        """Higher damage scores should give worse repairability status."""
        low_result  = assess_repairability(10.0, "low")
        high_result = assess_repairability(90.0, "high")
        status_rank = {"repairable": 0, "borderline": 1, "not_repairable": 2}
        assert status_rank[high_result["status"]] >= \
               status_rank[low_result["status"]]

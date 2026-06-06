"""
Test: Cost Estimation Service
==============================
Tests estimate_repair_cost() function.
Place at: backend/tests/test_cost_estimation.py

Run: pytest tests/test_cost_estimation.py -v
"""

import pytest
from app.services.cost_estimation import estimate_repair_cost


class TestCostEstimation:

    def test_returns_positive_number(self):
        """Cost must always be a positive number."""
        cost = estimate_repair_cost(50.0, "other", [])
        assert cost > 0

    def test_zero_damage_has_minimum_cost(self):
        """Even 0% damage should have some base cost."""
        cost = estimate_repair_cost(0.0, "other", [])
        assert cost > 0

    def test_high_damage_costs_more_than_low(self):
        """High damage score should produce higher cost."""
        cost_low  = estimate_repair_cost(10.0, "other", [])
        cost_high = estimate_repair_cost(90.0, "other", [])
        assert cost_high > cost_low

    def test_flagship_costs_more_than_budget(self):
        """Flagship phone costs more to repair than budget phone."""
        cost_flagship = estimate_repair_cost(50.0, "iphone_15_pro_max", [])
        cost_budget   = estimate_repair_cost(50.0, "nokia_g42",         [])
        assert cost_flagship > cost_budget

    def test_unknown_model_uses_default(self):
        """Unknown phone model should not crash — uses default weight."""
        cost = estimate_repair_cost(50.0, "unknown_brand_xyz_2099", [])
        assert cost > 0

    def test_detections_increase_cost(self):
        """More detections should increase the repair cost."""
        no_detections   = estimate_repair_cost(50.0, "other", [])
        with_detections = estimate_repair_cost(50.0, "other", [
            {"label": "crack",      "confidence": 0.9, "bbox": [0,0,0.1,0.1]},
            {"label": "dead_pixel", "confidence": 0.8, "bbox": [0,0,0.1,0.1]},
            {"label": "black_spot", "confidence": 0.7, "bbox": [0,0,0.1,0.1]},
        ])
        assert with_detections > no_detections

    def test_returns_float(self):
        """Cost must be a float."""
        cost = estimate_repair_cost(50.0, "samsung_s24", [])
        assert isinstance(cost, float)

    def test_iphone_models_ranked_correctly(self):
        """More expensive iPhone should cost more to repair."""
        cost_x    = estimate_repair_cost(50.0, "iphone_x",           [])
        cost_15pm = estimate_repair_cost(50.0, "iphone_15_pro_max",  [])
        assert cost_15pm > cost_x

    def test_none_phone_model_uses_default(self):
        """None phone model should not crash."""
        cost = estimate_repair_cost(50.0, None, [])
        assert cost > 0

    def test_empty_phone_model_uses_default(self):
        """Empty string phone model should not crash."""
        cost = estimate_repair_cost(50.0, "", [])
        assert cost > 0

    def test_full_damage_cost_reasonable(self):
        """100% damage cost should not be unreasonably high."""
        cost = estimate_repair_cost(100.0, "iphone_15_pro_max", [])
        assert cost < 10000   # should not exceed $10,000

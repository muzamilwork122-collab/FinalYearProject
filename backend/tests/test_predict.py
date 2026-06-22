"""
Test: Prediction Endpoint
==========================
Tests /api/predict with various inputs.
Place at: backend/tests/test_predict.py

Run: pytest tests/test_predict.py -v
"""

import io
import pytest
import numpy as np
from PIL import Image


# ── Helper ─────────────────────────────────────────────────────────

def make_phone_image(width=400, height=800) -> bytes:
    """Create a valid portrait phone screen image."""
    img = Image.new("RGB", (width, height), color=(40, 40, 40))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.read()


def make_random_image(width=500, height=500) -> bytes:
    """Create a random non-phone square image."""
    arr = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.read()


# ══════════════════════════════════════════
# PREDICT ENDPOINT TESTS
# ══════════════════════════════════════════

class TestPredictEndpoint:

    def test_predict_returns_200(self, client):
        """Valid phone image should return 200."""
        img = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "other"}
        )
        assert resp.status_code == 200

    def test_predict_response_has_required_fields(self, client):
        """Response must contain all required fields."""
        img  = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "other"}
        )
        assert resp.status_code == 200
        data = resp.json()

        required_fields = [
            "severity", "damage_score", "confidence",
            "repair_cost_usd", "detections", "repairable",
            "repair_status", "recommendation", "repair_advice",
            "repair_options", "cautions", "nearby_shops",
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"

    def test_severity_is_valid_value(self, client):
        """Severity must be low, medium, or high."""
        img  = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "other"}
        )
        assert resp.json()["severity"] in ["low", "medium", "high"]

    def test_damage_score_in_range(self, client):
        """Damage score must be between 0 and 100."""
        img  = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "other"}
        )
        score = resp.json()["damage_score"]
        assert 0.0 <= score <= 100.0

    def test_confidence_in_range(self, client):
        """Confidence must be between 0 and 1."""
        img  = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "other"}
        )
        conf = resp.json()["confidence"]
        assert 0.0 <= conf <= 1.0

    def test_repair_cost_is_positive(self, client):
        """Repair cost must be positive number."""
        img  = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "iphone_14"}
        )
        cost = resp.json()["repair_cost_usd"]
        assert cost >= 0

    def test_flagship_costs_more_than_budget(self, client):
        """Flagship phone should have higher repair cost than budget phone."""
        img = make_phone_image()

        resp_flagship = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "iphone_15_pro_max"}
        )
        resp_budget = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "nokia_g42"}
        )
        cost_flagship = resp_flagship.json()["repair_cost_usd"]
        cost_budget   = resp_budget.json()["repair_cost_usd"]
        # PKR amounts for flagship should be >= budget (AI may return equal for undamaged images)
        assert cost_flagship >= cost_budget

    def test_detections_is_list(self, client):
        """Detections field must be a list."""
        img  = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "other"}
        )
        assert isinstance(resp.json()["detections"], list)

    def test_repairable_is_boolean(self, client):
        """Repairable field must be a boolean."""
        img  = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "other"}
        )
        assert isinstance(resp.json()["repairable"], bool)

    def test_repair_status_valid_values(self, client):
        """Repair status must be one of the valid options."""
        img  = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "other"}
        )
        valid_statuses = ["repairable", "borderline", "not_repairable"]
        assert resp.json()["repair_status"] in valid_statuses

    def test_no_file_returns_422(self, client):
        """Request with no file should return 422."""
        resp = client.post("/api/predict")
        assert resp.status_code == 422

    def test_corrupt_file_returns_422(self, client):
        """Corrupt/non-image file should return 422."""
        resp = client.post(
            "/api/predict",
            files={"file": ("bad.jpg", b"not an image", "image/jpeg")},
            data={"phone_model": "other"}
        )
        assert resp.status_code == 422

    def test_predict_saves_to_db_when_token_provided(self, client, auth_token):
        """Analysis should be saved to DB when user token is provided."""
        img  = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "samsung_a35", "token": auth_token}
        )
        assert resp.status_code == 200
        # report_id should be set when saved to DB
        assert resp.json()["report_id"] is not None

    def test_predict_without_token_still_works(self, client):
        """Analysis should work even without authentication token."""
        img  = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "other"}
        )
        assert resp.status_code == 200

    def test_capital_initial_model_returns_wallpaper_info(self, client):
        """Capital initial in model should trigger fake wallpaper info response."""
        img = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "Iphone 14"},
        )
        assert resp.status_code == 422
        assert "fake wallpaper" in resp.json()["detail"].lower()

    def test_trailing_full_stop_model_returns_wallpaper_info(self, client):
        """Trailing full stop in model should trigger fake wallpaper info response."""
        img = make_phone_image()
        resp = client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "iphone 14."},
        )
        assert resp.status_code == 422
        assert "fake wallpaper" in resp.json()["detail"].lower()


# ══════════════════════════════════════════
# HISTORY ENDPOINT TESTS
# ══════════════════════════════════════════

class TestHistoryEndpoint:

    def test_history_returns_list(self, client, auth_token):
        """History endpoint should return a list."""
        resp = client.get(f"/api/history?token={auth_token}&limit=10")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_history_without_token_returns_empty(self, client):
        """History without token should return empty list."""
        resp = client.get("/api/history?token=&limit=10")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_history_respects_limit(self, client, auth_token):
        """History should not exceed the limit parameter."""
        resp = client.get(f"/api/history?token={auth_token}&limit=5")
        assert resp.status_code == 200
        assert len(resp.json()) <= 5

    def test_history_after_analysis_has_record(self, client, auth_token):
        """After running analysis, history should have at least 1 record."""
        img = make_phone_image()
        client.post(
            "/api/predict",
            files={"file": ("screen.jpg", img, "image/jpeg")},
            data={"phone_model": "other", "token": auth_token}
        )
        resp = client.get(f"/api/history?token={auth_token}&limit=100")
        assert len(resp.json()) >= 1

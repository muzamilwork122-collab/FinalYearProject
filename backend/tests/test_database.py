"""
Test: Database Operations
==========================
Tests save_analysis(), get_analysis(), get_recent_analyses()
Place at: backend/tests/test_database.py

Run: pytest tests/test_database.py -v
"""

import uuid
import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.db.models import Analysis, DetectionRecord, User
from app.db.db_service import save_analysis, get_analysis, get_recent_analyses


# ── In-memory SQLite DB for testing (no PostgreSQL needed) ─────────
@pytest.fixture
def test_db():
    """Create a fresh in-memory database for each test."""
    engine     = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    Session    = sessionmaker(bind=engine)
    db         = Session()
    yield db
    db.close()
    Base.metadata.drop_all(engine)


@pytest.fixture
def test_user(test_db):
    """Create a test user in the DB."""
    user = User(
        id            = uuid.uuid4(),
        name          = "Test User",
        email         = "test@screenai.com",
        password_hash = "hashed_password",
        created_at    = datetime.utcnow(),
    )
    test_db.add(user)
    test_db.commit()
    return user


# ══════════════════════════════════════════
# SAVE ANALYSIS TESTS
# ══════════════════════════════════════════

class TestSaveAnalysis:

    def test_save_analysis_returns_analysis_object(self, test_db):
        """save_analysis must return an Analysis object."""
        result = save_analysis(
            test_db,
            user_id          = None,
            phone_model      = "iphone_14",
            original_filename= "test.jpg",
            severity         = "low",
            damage_score     = 25.0,
            confidence       = 0.85,
            repair_cost_usd  = 120.0,
            detections       = [],
        )
        assert isinstance(result, Analysis)

    def test_saved_analysis_has_uuid(self, test_db):
        """Saved analysis must have a valid UUID."""
        result = save_analysis(
            test_db,
            user_id=None, phone_model="other",
            original_filename="test.jpg",
            severity="low", damage_score=10.0,
            confidence=0.9, repair_cost_usd=60.0,
            detections=[],
        )
        assert result.id is not None
        # Should be valid UUID
        str(result.id)

    def test_saved_analysis_fields_correct(self, test_db):
        """Saved analysis should have correct field values."""
        result = save_analysis(
            test_db,
            user_id=None, phone_model="samsung_s24",
            original_filename="crack.jpg",
            severity="high", damage_score=88.0,
            confidence=0.92, repair_cost_usd=250.0,
            detections=[],
        )
        assert result.phone_model       == "samsung_s24"
        assert result.severity          == "high"
        assert result.damage_score      == 88.0
        assert result.confidence        == 0.92
        assert result.repair_cost_usd   == 250.0
        assert result.original_filename == "crack.jpg"

    def test_save_analysis_with_detections(self, test_db):
        """Detections should be saved and linked to analysis."""
        detections = [
            {"label": "crack",      "confidence": 0.9,
             "bbox": [0.1, 0.2, 0.3, 0.4]},
            {"label": "dead_pixel", "confidence": 0.8,
             "bbox": [0.5, 0.6, 0.05, 0.05]},
        ]
        result = save_analysis(
            test_db,
            user_id=None, phone_model="other",
            original_filename="test.jpg",
            severity="medium", damage_score=45.0,
            confidence=0.85, repair_cost_usd=100.0,
            detections=detections,
        )
        assert len(result.detections) == 2
        labels = [d.label for d in result.detections]
        assert "crack"      in labels
        assert "dead_pixel" in labels

    def test_save_with_user_id(self, test_db, test_user):
        """Analysis saved with user_id should be linked to user."""
        result = save_analysis(
            test_db,
            user_id=test_user.id, phone_model="iphone_11",
            original_filename="test.jpg",
            severity="medium", damage_score=40.0,
            confidence=0.80, repair_cost_usd=100.0,
            detections=[],
        )
        assert result.user_id == test_user.id

    def test_detection_bbox_saved_correctly(self, test_db):
        """Bounding box coordinates should be saved accurately."""
        detections = [
            {"label": "crack", "confidence": 0.9,
             "bbox": [0.1, 0.2, 0.3, 0.4]}
        ]
        result = save_analysis(
            test_db,
            user_id=None, phone_model="other",
            original_filename="test.jpg",
            severity="low", damage_score=10.0,
            confidence=0.85, repair_cost_usd=60.0,
            detections=detections,
        )
        det = result.detections[0]
        assert abs(det.bbox_x - 0.1) < 0.001
        assert abs(det.bbox_y - 0.2) < 0.001
        assert abs(det.bbox_w - 0.3) < 0.001
        assert abs(det.bbox_h - 0.4) < 0.001


# ══════════════════════════════════════════
# GET ANALYSIS TESTS
# ══════════════════════════════════════════

class TestGetAnalysis:

    def test_get_existing_analysis(self, test_db):
        """Should retrieve a saved analysis by ID."""
        saved = save_analysis(
            test_db,
            user_id=None, phone_model="other",
            original_filename="test.jpg",
            severity="low", damage_score=10.0,
            confidence=0.9, repair_cost_usd=60.0,
            detections=[],
        )
        fetched = get_analysis(test_db, str(saved.id))
        assert fetched is not None
        assert fetched.id == saved.id

    def test_get_nonexistent_returns_none(self, test_db):
        """Non-existent ID should return None."""
        fake_id = str(uuid.uuid4())
        result  = get_analysis(test_db, fake_id)
        assert result is None

    def test_get_invalid_uuid_returns_none(self, test_db):
        """Invalid UUID string should return None."""
        result = get_analysis(test_db, "not-a-valid-uuid")
        assert result is None

    def test_get_returns_correct_fields(self, test_db):
        """Retrieved analysis should have correct data."""
        saved = save_analysis(
            test_db,
            user_id=None, phone_model="xiaomi_13",
            original_filename="test.jpg",
            severity="high", damage_score=90.0,
            confidence=0.95, repair_cost_usd=200.0,
            detections=[],
        )
        fetched = get_analysis(test_db, str(saved.id))
        assert fetched.severity        == "high"
        assert fetched.damage_score    == 90.0
        assert fetched.phone_model     == "xiaomi_13"


# ══════════════════════════════════════════
# GET RECENT ANALYSES TESTS
# ══════════════════════════════════════════

class TestGetRecentAnalyses:

    def test_returns_list(self, test_db):
        """Should return a list."""
        result = get_recent_analyses(test_db, limit=10)
        assert isinstance(result, list)

    def test_empty_db_returns_empty_list(self, test_db):
        """Empty DB should return empty list."""
        result = get_recent_analyses(test_db, limit=10)
        assert result == []

    def test_respects_limit(self, test_db):
        """Should not return more than limit items."""
        for i in range(10):
            save_analysis(
                test_db,
                user_id=None, phone_model="other",
                original_filename=f"test{i}.jpg",
                severity="low", damage_score=float(i),
                confidence=0.8, repair_cost_usd=60.0,
                detections=[],
            )
        result = get_recent_analyses(test_db, limit=5)
        assert len(result) <= 5

    def test_returns_most_recent_first(self, test_db):
        """Most recent analysis should be first."""
        for i in range(3):
            save_analysis(
                test_db,
                user_id=None, phone_model="other",
                original_filename=f"test{i}.jpg",
                severity="low", damage_score=float(i * 10),
                confidence=0.8, repair_cost_usd=60.0,
                detections=[],
            )
        result = get_recent_analyses(test_db, limit=10)
        # Latest created_at should be first
        if len(result) > 1:
            assert result[0].created_at >= result[1].created_at

    def test_to_dict_has_required_keys(self, test_db):
        """Analysis.to_dict() must have required keys."""
        save_analysis(
            test_db,
            user_id=None, phone_model="other",
            original_filename="test.jpg",
            severity="medium", damage_score=50.0,
            confidence=0.85, repair_cost_usd=100.0,
            detections=[],
        )
        result   = get_recent_analyses(test_db, limit=1)
        d        = result[0].to_dict()
        required = ["id", "created_at", "phone_model",
                    "severity", "damage_score", "confidence", "repair_cost_usd"]
        for key in required:
            assert key in d, f"Missing key: {key}"

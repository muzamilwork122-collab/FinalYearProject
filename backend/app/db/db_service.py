import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from app.db.models import Analysis, DetectionRecord

logger = logging.getLogger(__name__)


def save_analysis(
    db: Session,
    *,
    user_id=None,                        # ← was: user_id=user_id (invalid)
    phone_model: Optional[str],
    original_filename: Optional[str],
    severity: str,
    damage_score: float,
    confidence: float,
    repair_cost_usd: float,
    detections: List[dict],
    image_path: Optional[str] = None,
    mask_path: Optional[str] = None,
) -> Analysis:
    analysis = Analysis(
        user_id=user_id,                 # ← was: MISSING (never saved)
        phone_model=phone_model,
        original_filename=original_filename,
        severity=severity,
        damage_score=damage_score,
        confidence=confidence,
        repair_cost_usd=repair_cost_usd,
        image_path=image_path,
        mask_path=mask_path,
    )
    db.add(analysis)
    db.flush()

    for det in detections:
        bbox   = det.get("bbox", [0, 0, 0, 0])
        record = DetectionRecord(
            analysis_id=analysis.id,
            label=det.get("label", "damage"),
            confidence=det.get("confidence", 0.0),
            bbox_x=bbox[0] if len(bbox) > 0 else None,
            bbox_y=bbox[1] if len(bbox) > 1 else None,
            bbox_w=bbox[2] if len(bbox) > 2 else None,
            bbox_h=bbox[3] if len(bbox) > 3 else None,
        )
        db.add(record)

    db.commit()
    db.refresh(analysis)
    logger.info(f"Saved analysis {analysis.id} to DB | user_id={user_id}")
    return analysis


def get_analysis(db: Session, analysis_id: str) -> Optional[Analysis]:
    try:
        import uuid
        uid = uuid.UUID(analysis_id)
    except ValueError:
        return None
    return db.query(Analysis).filter(Analysis.id == uid).first()


def get_recent_analyses(db: Session, limit: int = 20) -> List[Analysis]:
    return (
        db.query(Analysis)
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .all()
    )
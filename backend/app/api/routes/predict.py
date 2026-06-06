import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from typing import Optional

from app.schemas.response import PredictResponse, Detection
from app.services.preprocessing import preprocess_image
from app.services.feature_extraction import extract_features
from app.services.postprocessing import overlay_mask_on_image, encode_image_base64
from app.services.cost_estimation import estimate_repair_cost
from app.services.validation import validate_image_bytes, assess_repairability
from app.models.segmentation import run_segmentation
from app.models.detection import run_detection
from app.models.severity import run_severity
from app.db.database import get_db
from app.db.db_service import save_analysis, get_recent_analyses, get_analysis
from slowapi import Limiter
from slowapi.util import get_remote_address
import requests
from app.db.models import Analysis

limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)
router = APIRouter()

import os

# Use higher limit in testing
_limit = "1000/minute" if os.getenv("TESTING") == "true" else "10/minute"

@router.post("/predict")
@limiter.limit(_limit) 
async def predict(
    request: Request,
    file: UploadFile = File(...),
    phone_model: Optional[str] = Form(default="other"),
    token: Optional[str] = Form(default=None),   
    db: Session = Depends(get_db),
):
    # ── 1. Read image ─────────────────────────────────────────────────────
    image_bytes = await file.read()

    # ── 2. Validate — is this actually a phone screen? ───────────────────
    validation = validate_image_bytes(image_bytes)
    if not validation["valid"]:
        raise HTTPException(
            status_code=422,
            detail=validation["error"]
        )

    logger.info(f"Predict | file={file.filename} size={len(image_bytes)}B model={phone_model}")

    # ── 3. Preprocess ─────────────────────────────────────────────────────
    tensor = preprocess_image(image_bytes)

    # ── 4. AI models ──────────────────────────────────────────────────────
    mask           = run_segmentation(tensor)
    detections_raw = run_detection(tensor)

    # ── 5. Severity + score ───────────────────────────────────────────────
    features                           = extract_features(mask, detections_raw)
    severity, confidence, damage_score = run_severity(features)

    # ── 6. Repairability assessment ───────────────────────────────────────
    repairability = assess_repairability(
        damage_score=damage_score,
        severity=severity,
        mask=mask,
    )

    # ── 7. Cost estimation ────────────────────────────────────────────────
    repair_cost = estimate_repair_cost(damage_score, phone_model, detections_raw)

    # ── 8. Annotated overlay image ────────────────────────────────────────
    annotated_bytes = overlay_mask_on_image(image_bytes, mask)
    image_url       = encode_image_base64(annotated_bytes, format="JPEG")

    # ── Get user_id from token ────────────────────────────────────────────
    user_id = None
    if token:
        try:
            from app.api.routes.auth import _tokens
            import uuid
            uid_str = _tokens.get(token)
            if uid_str:
                user_id = uuid.UUID(uid_str)
                logger.info(f"Token resolved → user_id={user_id}")
            else:
                logger.warning("Token not found in _tokens store")
        except Exception as e:
            logger.error(f"Token resolve failed: {e}")

   

    # ── 9. Save to DB ─────────────────────────────────────────────────────
    report_id = None
    try:
        saved = save_analysis(
            db,
            user_id=user_id,
            phone_model=phone_model,
            original_filename=file.filename,
            severity=severity,
            damage_score=damage_score,
            confidence=confidence,
            repair_cost_usd=repair_cost,
            detections=detections_raw,
        )
        report_id = str(saved.id)
    except Exception as db_err:
        logger.error(f"DB save failed: {db_err}", exc_info=True)

    detections = [Detection(**d) for d in detections_raw]

    logger.info(
        f"Result | severity={severity} score={damage_score} "
        f"repairable={repairability['repairable']} cost=${repair_cost}"
    )

    return {
        "severity":        severity,
        "damage_score":    damage_score,
        "confidence":      confidence,
        "repair_cost_usd": repair_cost,
        "detections":      [d.dict() for d in detections],
        "image_url":       image_url,
        "report_id":       report_id,
        "repairable":      repairability["repairable"],
        "repair_status":   repairability["status"],
        "recommendation":  repairability["recommendation"],
        "repair_reason":   repairability["reason"],
        "repair_advice":   repairability["repair_advice"],
    }


@router.get("/history")
def get_history(token: str = "", limit: int = 100, db: Session = Depends(get_db)):
    try:
        from app.api.routes.auth import _tokens
        import uuid
        user_id_str = _tokens.get(token)
        if not user_id_str:
            return []   # not logged in — return empty
        uid = uuid.UUID(user_id_str)
        analyses = (
            db.query(Analysis)
            .filter(Analysis.user_id == uid)   # ← filter by THIS user only
            .order_by(Analysis.created_at.desc())
            .limit(limit)
            .all()
        )
        return [a.to_dict() for a in analyses]
    except Exception as e:
        return []


@router.get("/report/{analysis_id}")
def get_report(analysis_id: str, db: Session = Depends(get_db)):
    analysis = get_analysis(db, analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        **analysis.to_dict(),
        "detections": [
            {"label": d.label, "confidence": d.confidence,
             "bbox": [d.bbox_x, d.bbox_y, d.bbox_w, d.bbox_h]}
            for d in analysis.detections
        ],
    }

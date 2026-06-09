import logging
import base64
import os
import io
import uuid

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from typing import Optional
from PIL import Image as PILImage

from app.core.config import settings
from app.schemas.response import Detection
from app.services.validation import validate_image_bytes
from app.db.database import get_db
from app.db.db_service import save_analysis, get_analysis
from app.db.models import Analysis
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)
router = APIRouter()

_limit = "1000/minute" if os.getenv("TESTING") == "true" else "10/minute"


# ── OpenAI analysis (same pattern as chat.py) ─────────────────────────────

async def analyze_with_openai(image_bytes: bytes, phone_model: str) -> dict:
    key = settings.OPENAI_API_KEY
    if not key:
        logger.error("OPENAI_API_KEY is not set")
        return None

    try:
        from openai import OpenAI
        client = OpenAI(api_key=key)

        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        prompt = f"""You are an expert smartphone screen damage assessment AI.

Analyze this smartphone screen image and provide a detailed damage report.
Phone model: {phone_model.replace('_', ' ').title() if phone_model else 'Unknown'}

Respond ONLY with a valid JSON object in exactly this format:
{{
    "severity": "low" or "medium" or "high",
    "damage_score": number between 0 and 100,
    "confidence": number between 0.0 and 1.0,
    "repair_cost_usd": estimated repair cost as number,
    "repairable": true or false,
    "repair_status": "repairable" or "borderline" or "not_repairable",
    "recommendation": "short recommendation text",
    "repair_advice": "detailed repair advice in 2-3 sentences mentioning PKR cost",
    "detections": [
        {{
            "label": "crack" or "dead_pixel" or "black_spot" or "shatter",
            "confidence": number between 0.0 and 1.0,
            "bbox": [0.0, 0.0, 0.0, 0.0]
        }}
    ],
    "damage_description": "detailed description of visible damage",
    "nearby_shops": [
        {{
            "name": "real shop name in {phone_model} repair area Pakistan",
            "area": "area/market name e.g. Hafeez Center, Hall Road",
            "city": "city name",
            "phone": "phone number if known or empty string",
            "specialty": "one line what they are known for"
        }}
    ]
}}

Rules:
- damage_score 0-20 = minor scratches only = low
- damage_score 21-60 = visible cracks = medium
- damage_score 61-85 = severe cracks = high but repairable
- damage_score 86-100 = shattered/dead LCD = not repairable
- repair_cost_usd: budget according to given model and make sure according to Pakistan market price must be very very cheap according to Pakistan economy.
- If no damage visible, damage_score=0, severity=low, repairable=true
- nearby_shops: return exactly 3 real well-known repair markets or shops in Pakistan
- Focus shops on basis of user location if possible (use "city" field in shop data)
- detections array can be empty if no damage zones identified"""
        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=600,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64_image}",
                            "detail": "high"
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }]
        )

        import json
        content = response.choices[0].message.content.strip()
        content = content.replace("```json", "").replace("```", "").strip()
        result = json.loads(content)

        logger.info(
            f"OpenAI analysis | severity={result.get('severity')} "
            f"score={result.get('damage_score')} "
            f"cost=${result.get('repair_cost_usd')}"
        )
        return result

    except Exception as e:
        logger.error(f"OpenAI analysis failed: {e}")
        return None


# ── Routes ─────────────────────────────────────────────────────────────────

@router.post("/predict")
@limiter.limit(_limit)
async def predict(
    request:     Request,
    file:        UploadFile        = File(...),
    phone_model: Optional[str]     = Form(default="other"),
    token:       Optional[str]     = Form(default=None),
    db:          Session           = Depends(get_db),
):
    # ── 1. Read and validate image ────────────────────────────────
    image_bytes = await file.read()
    validation  = validate_image_bytes(image_bytes)
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail=validation["error"])

    logger.info(f"Predict | file={file.filename} size={len(image_bytes)}B model={phone_model}")

    # ── 2. Always use OpenAI (no local models) ────────────────────
    ai_result = await analyze_with_openai(image_bytes, phone_model or "other")

    if not ai_result:
        raise HTTPException(status_code=500, detail="OpenAI analysis failed. Check your API key.")

    # ── 3. Convert image to base64 for response ───────────────────
    pil_img = PILImage.open(io.BytesIO(image_bytes)).convert("RGB")
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=85)
    image_url = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

    # ── 4. Get user_id from token ─────────────────────────────────
    user_id = None
    if token:
        try:
            from app.api.routes.auth import _tokens
            uid_str = _tokens.get(token)
            if uid_str:
                user_id = uuid.UUID(uid_str)
        except Exception:
            pass

    # ── 5. Save to DB ─────────────────────────────────────────────
    report_id = None
    try:
        saved = save_analysis(
            db,
            user_id           = user_id,
            phone_model       = phone_model,
            original_filename = file.filename,
            severity          = ai_result.get("severity", "low"),
            damage_score      = float(ai_result.get("damage_score", 0)),
            confidence        = float(ai_result.get("confidence", 0.9)),
            repair_cost_usd   = float(ai_result.get("repair_cost_usd", 0)),
            detections        = ai_result.get("detections", []),
        )
        report_id = str(saved.id)
    except Exception as e:
        logger.error(f"DB save failed: {e}")

    return {
        "severity":        ai_result.get("severity",          "low"),
        "damage_score":    ai_result.get("damage_score",      0.0),
        "confidence":      ai_result.get("confidence",        0.9),
        "repair_cost_usd": ai_result.get("repair_cost_usd",   0.0),
        "detections":      ai_result.get("detections",        []),
        "image_url":       image_url,
        "report_id":       report_id,
        "repairable":      ai_result.get("repairable",        True),
        "repair_status":   ai_result.get("repair_status",     "repairable"),
        "recommendation":  ai_result.get("recommendation",    ""),
        "repair_reason":   ai_result.get("damage_description",""),
        "repair_advice":   ai_result.get("repair_advice",     ""),
        "nearby_shops":    ai_result.get("nearby_shops",      []), 
    }


@router.get("/history")
def get_history(token: str = "", limit: int = 100, db: Session = Depends(get_db)):
    try:
        from app.api.routes.auth import _tokens
        user_id_str = _tokens.get(token)
        if not user_id_str:
            return []
        uid = uuid.UUID(user_id_str)
        analyses = (
            db.query(Analysis)
            .filter(Analysis.user_id == uid)
            .order_by(Analysis.created_at.desc())
            .limit(limit)
            .all()
        )
        return [a.to_dict() for a in analyses]
    except Exception as e:
        logger.error(f"History fetch failed: {e}")
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

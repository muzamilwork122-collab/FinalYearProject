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


# ── Detection helpers ──────────────────────────────────────────────────────

def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _normalize_detections(detections: list, width: int, height: int) -> list:
    """Convert model bboxes to normalized [x, y, w, h] fractions (0-1).

    The model is asked for pixel coordinates of a width x height image, but it
    sometimes returns already-normalized values. We detect which by magnitude
    (any component > 1.5 implies pixels), divide by the real dimensions, clamp
    into frame, and drop any zero-area box so the overlay only draws real damage.
    """
    if not isinstance(detections, list) or width <= 0 or height <= 0:
        return []

    normalized = []
    for det in detections:
        bbox = det.get("bbox") if isinstance(det, dict) else None
        if not (isinstance(bbox, (list, tuple)) and len(bbox) == 4):
            continue
        try:
            x, y, w, h = (float(v) for v in bbox)
        except (TypeError, ValueError):
            continue

        if max(abs(x), abs(y), abs(w), abs(h)) > 1.5:
            x, y, w, h = x / width, y / height, w / width, h / height

        x, y = _clamp01(x), _clamp01(y)
        w, h = _clamp01(w), _clamp01(h)
        if x + w > 1.0:
            w = 1.0 - x
        if y + h > 1.0:
            h = 1.0 - y
        if w <= 0.0 or h <= 0.0:
            continue

        det["bbox"] = [round(x, 4), round(y, 4), round(w, 4), round(h, 4)]
        normalized.append(det)

    return normalized


# ── OpenAI analysis (same pattern as chat.py) ─────────────────────────────

async def analyze_with_openai(image_bytes: bytes, phone_model: str, location: str, width: int, height: int) -> dict:
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
User location: {location if location else 'Pakistan'}

IMAGE GEOMETRY (critical for the bounding boxes):
- This exact image is {width} pixels wide and {height} pixels tall.
- The origin (0, 0) is the TOP-LEFT corner. x increases to the right, y increases downward.
- Every bbox you output MUST be in PIXELS of THIS image, as [x, y, w, h] where (x, y) is the
  top-left of the box and (w, h) is its width and height in pixels.

Respond ONLY with a valid JSON object in exactly this format:
{{
    "model_valid": true or false,
    "model_feedback": "empty string if valid; if invalid, ONE short sentence stating the model was not recognized and asking the user to double-check the spelling/model number",
    "severity": "low" or "medium" or "high",
    "damage_score": number between 0 and 100,
    "confidence": number between 0.0 and 1.0,
    "repair_cost_pkr": estimated repair cost in Pakistani Rupees (PKR) as a number,
    "repairable": true or false,
    "repair_status": "repairable" or "borderline" or "not_repairable",
    "recommendation": "short recommendation text",
    "repair_advice": "detailed repair advice in 2-3 sentences mentioning PKR cost",
    "repair_options": [
        {{
            "name": "Original / OEM display",
            "cost_pkr": number in PKR,
            "duration": "estimated duration e.g. 1-2 hours or 1 day"
        }},
        {{
            "name": "Aftermarket (China) - Grade A / high copy",
            "cost_pkr": number in PKR,
            "duration": "estimated duration"
        }},
        {{
            "name": "Economy copy (China)",
            "cost_pkr": number in PKR,
            "duration": "estimated duration"
        }}
    ],
    "cautions": [
        "caution statement 1",
        "caution statement 2"
    ],
    "detections": [
        {{
            "label": "crack" or "dead_pixel" or "black_spot" or "shatter" or "scratch",
            "confidence": number between 0.0 and 1.0,
            "bbox": [x_pixels, y_pixels, width_pixels, height_pixels]
        }}
    ],
    "damage_description": "detailed description of visible damage",
    "nearby_shops": [
        {{
            "name": "real shop name in {phone_model} repair area near {location} Pakistan",
            "area": "area/market name e.g. Hafeez Center, Hall Road, Amma Tower",
            "city": "city name",
            "phone": "phone number if known or empty string",
            "specialty": "one line what they are known for"
        }}
    ]
}}

Rules:
- model_valid: First verify the phone model "{phone_model.replace('_', ' ').title() if phone_model else 'Unknown'}" is a plausible, real smartphone. Only set model_valid=false when the model is clearly fictional or impossible (e.g. "iPhone 19 Pro Max", "Galaxy Z99", "Nokia 9999"). When invalid, model_feedback must ONLY state that the model was not recognized and ask the user to re-check the name/number — do NOT name a "latest" model, do NOT claim which models currently exist, and do NOT suggest a specific replacement model, because your knowledge of recent releases may be out of date. If the model is "Unknown", "Other", empty, or simply newer than your training data but otherwise plausible, set model_valid=true. Otherwise model_valid=true with model_feedback="".
- damage_score 0-20 = minor scratches only = low
- damage_score 21-60 = visible cracks = medium
- damage_score 61-85 = severe cracks = high but repairable
- damage_score 86-100 = shattered/dead LCD = not repairable
- repair_cost_pkr: budget according to the given model and the Pakistan market — keep prices realistic and affordable for Pakistan.
- repair_options: when repairable, ALWAYS return 2-4 options that include an "Original / OEM display" and at least one China/aftermarket variant (Grade A and/or economy). Original must be the most expensive, economy the cheapest. For glass-only damage you may also add an "Outer glass only" option. Each option needs a realistic cost_pkr for THIS model and a duration.
- If no damage visible, damage_score=0, severity=low, repairable=true, detections=[].
- nearby_shops: return exactly 3 real well-known repair markets or shops in Pakistan in the specified city/area of {location}.
- Focus shops on basis of user location: {location}.

DETECTIONS / BOUNDING BOXES (very important — these are drawn on the image):
- Add ONE detection for EACH distinct visible damage region (a crack line, a spider/shatter web, a dead/black zone, a deep scratch).
- Each bbox must TIGHTLY enclose only that damage in pixel coordinates of this {width}x{height} image. Do NOT return a box that covers the whole screen.
- Prefer several smaller boxes over one big box. If a crack runs into a corner, box the actual visible crack, not the entire side.
- Ensure x >= 0, y >= 0, x + w <= {width}, y + h <= {height}. Look carefully at where the damage actually is before choosing coordinates.
- detections array can be empty ONLY if there is genuinely no visible damage."""
        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=1500,
            response_format={"type": "json_object"},
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
        choice = response.choices[0]
        content = (choice.message.content or "").strip()
        content = content.replace("```json", "").replace("```", "").strip()
        if not content:
            logger.error(f"OpenAI returned empty content (finish_reason={choice.finish_reason})")
            return None
        result = json.loads(content)

        result["detections"] = _normalize_detections(result.get("detections", []), width, height)

        logger.info(
            f"OpenAI analysis | severity={result.get('severity')} "
            f"score={result.get('damage_score')} "
            f"cost=PKR {result.get('repair_cost_pkr')}"
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
    location:    Optional[str]     = Form(default="Lahore"),
    token:       Optional[str]     = Form(default=None),
    db:          Session           = Depends(get_db),
):
    # ── 1. Read and validate image ────────────────────────────────
    image_bytes = await file.read()
    validation  = validate_image_bytes(image_bytes)
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail=validation["error"])

    logger.info(f"Predict | file={file.filename} size={len(image_bytes)}B model={phone_model} location={location}")

    # ── 2. Normalize orientation + re-encode ONCE ─────────────────
    # The same JPEG is sent to the model AND returned to the client, and its
    # width/height drive the bounding-box coordinates — so all three stay aligned.
    from PIL import ImageOps
    pil_img = ImageOps.exif_transpose(PILImage.open(io.BytesIO(image_bytes))).convert("RGB")
    width, height = pil_img.size
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=90)
    jpeg_bytes = buf.getvalue()
    image_url = "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode()

    # ── 3. Always use OpenAI (no local models) ────────────────────
    ai_result = await analyze_with_openai(jpeg_bytes, phone_model or "other", location or "Lahore", width, height)

    if not ai_result:
        raise HTTPException(status_code=500, detail="Analysis failed.")

    # ── 3b. Reject implausible / non-existent phone models ────────
    if ai_result.get("model_valid") is False:
        feedback = (ai_result.get("model_feedback") or "").strip()
        pretty_model = (phone_model or "").replace("_", " ").title()
        detail = feedback or f'"{pretty_model}" does not appear to be a real phone model. Please enter a valid model.'
        raise HTTPException(status_code=422, detail=detail)

    # ── 4. Get user_id from token ─────────────────────────────────
    user_id = None
    if token:
        try:
            from app.api.routes.auth import resolve_token
            uid_str = resolve_token(token)
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
            repair_cost_usd   = float(ai_result.get("repair_cost_pkr", 0.0)),
            detections        = ai_result.get("detections", []),
        )
        report_id = str(saved.id)
    except Exception as e:
        logger.error(f"DB save failed: {e}")

    return {
        "severity":        ai_result.get("severity",          "low"),
        "damage_score":    ai_result.get("damage_score",      0.0),
        "confidence":      ai_result.get("confidence",        0.9),
        "repair_cost_usd": float(ai_result.get("repair_cost_pkr", 0.0)),
        "detections":      ai_result.get("detections",        []),
        "image_url":       image_url,
        "report_id":       report_id,
        "repairable":      ai_result.get("repairable",        True),
        "repair_status":   ai_result.get("repair_status",     "repairable"),
        "recommendation":  ai_result.get("recommendation",    ""),
        "repair_reason":   ai_result.get("damage_description",""),
        "repair_advice":   ai_result.get("repair_advice",     ""),
        "nearby_shops":    ai_result.get("nearby_shops",      []), 
        "repair_options":  ai_result.get("repair_options",     []),
        "cautions":        ai_result.get("cautions",           []),
    }


@router.get("/history")
def get_history(token: str = "", limit: int = 100, db: Session = Depends(get_db)):
    try:
        from app.api.routes.auth import resolve_token
        user_id_str = resolve_token(token)
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


@router.delete("/history/{analysis_id}")
def delete_analysis(analysis_id: str, token: str = "", db: Session = Depends(get_db)):
    from app.api.routes.auth import resolve_token
    user_id_str = resolve_token(token)
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        uid = uuid.UUID(user_id_str)
        target = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    analysis = db.query(Analysis).filter(Analysis.id == target).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if analysis.user_id != uid:
        raise HTTPException(status_code=403, detail="You can only delete your own analyses")

    db.delete(analysis)
    db.commit()
    logger.info(f"Deleted analysis {analysis_id} for user {uid}")
    return {"deleted": True, "id": analysis_id}


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

from pydantic import BaseModel
from typing import List, Optional


class Detection(BaseModel):
    label: str
    confidence: float
    bbox: List[float]  # [x, y, w, h] normalized 0–1


class PredictResponse(BaseModel):
    severity: str            # "low" | "medium" | "high"
    damage_score: float      # numeric 0–100 (NEW)
    confidence: float        # classifier confidence 0–1
    repair_cost_usd: float   # estimated repair cost in USD (NEW)
    detections: List[Detection]
    image_url: Optional[str] # base64 annotated image
    report_id: Optional[str] # UUID saved in DB (future)

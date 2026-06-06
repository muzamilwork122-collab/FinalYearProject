import logging
from typing import List, Dict
import torch

from app.models.model_loader import get_model
from app.core.config import settings

logger = logging.getLogger(__name__)


def run_detection(tensor: torch.Tensor) -> List[Dict]:
    """
    Run object detection model on a preprocessed image tensor.
    Returns list of detections: [{label, confidence, bbox: [x, y, w, h]}]
    """
    model = get_model("detection")
    if model is None:
        logger.warning("Detection model not loaded — returning empty detections")
        return []

    with torch.no_grad():
        raw = model(tensor)

    detections = []
    for pred in raw:
        confidence = float(pred.get("score", 0))
        if confidence < settings.CONFIDENCE_THRESHOLD:
            continue
        detections.append({
            "label": pred.get("label", "damage"),
            "confidence": confidence,
            "bbox": pred.get("bbox", [0, 0, 0, 0]),  # normalized [x, y, w, h]
        })

    return detections

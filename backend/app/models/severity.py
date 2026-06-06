import logging
import numpy as np
from typing import Tuple

from app.models.model_loader import get_model

logger = logging.getLogger(__name__)

SEVERITY_LABELS = ["low", "medium", "high"]

# Thresholds used when model is not loaded (rule-based fallback)
# damage_ratio is the fraction of pixels flagged as damaged (0.0 – 1.0)
RULE_THRESHOLDS = {
    "low":    (0.00, 0.10),   # 0 – 10% of screen damaged
    "medium": (0.10, 0.35),   # 10 – 35%
    "high":   (0.35, 1.00),   # 35 – 100%
}

# Score ranges for each severity bucket (maps to 0–100 output scale)
SCORE_RANGES = {
    "low":    (0,   35),
    "medium": (36,  70),
    "high":   (71, 100),
}


def _damage_ratio_to_score(damage_ratio: float, label: str) -> float:
    """
    Map a raw damage_ratio (0–1) to a human-readable 0–100 score
    within the correct severity bucket.
    """
    lo_thresh, hi_thresh = RULE_THRESHOLDS[label]
    lo_score, hi_score = SCORE_RANGES[label]

    bucket_size = hi_thresh - lo_thresh or 1e-6
    position = (damage_ratio - lo_thresh) / bucket_size        # 0–1 within bucket
    score = lo_score + position * (hi_score - lo_score)
    return round(float(np.clip(score, lo_score, hi_score)), 1)


def _rule_based_severity(features: np.ndarray) -> Tuple[str, float, float]:
    """
    Fallback when the LightGBM model is not loaded.
    Uses damage_ratio (features[0]) directly.
    Returns (label, confidence, damage_score)
    """
    damage_ratio = float(features[0])

    if damage_ratio < RULE_THRESHOLDS["medium"][0]:
        label = "low"
        confidence = round(1.0 - damage_ratio / 0.10, 2)
    elif damage_ratio < RULE_THRESHOLDS["high"][0]:
        label = "medium"
        confidence = 0.70
    else:
        label = "high"
        confidence = round(min(0.95, 0.70 + damage_ratio), 2)

    score = _damage_ratio_to_score(damage_ratio, label)
    return label, confidence, score


def run_severity(features: np.ndarray) -> Tuple[str, float, float]:
    """
    Classify damage severity from extracted feature vector.

    Args:
        features: numpy array of shape (5,)
                  [damage_ratio, damage_area, num_detections,
                   avg_confidence, max_confidence]

    Returns:
        Tuple of:
          - severity_label: "low" | "medium" | "high"
          - confidence:     float 0–1  (classifier probability)
          - damage_score:   float 0–100 (human-readable score)
    """
    model = get_model("severity")

    if model is None:
        logger.warning("Severity model not loaded — using rule-based fallback")
        return _rule_based_severity(features)

    # --- LightGBM path ---
    probs = model.predict_proba([features])[0]   # shape: (3,)
    idx = int(np.argmax(probs))
    label = SEVERITY_LABELS[idx]
    confidence = float(probs[idx])

    # Convert damage_ratio → 0–100 score within the predicted bucket
    damage_ratio = float(features[0])
    score = _damage_ratio_to_score(damage_ratio, label)

    logger.info(
        f"Severity: {label} | confidence: {confidence:.2f} | score: {score}"
    )
    return label, confidence, score

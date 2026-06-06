"""
Repair cost estimation service.

Combines:
  - damage_score (0–100)     — how bad the damage is
  - phone_model multiplier   — flagship vs budget device
  - damage type surcharges   — dead pixels cost more than hairline cracks

Returns estimated repair cost in USD.
"""

import logging
from app.schemas.request import PHONE_MODEL_COST_WEIGHTS, BASE_REPAIR_COST_USD

logger = logging.getLogger(__name__)

# Extra cost added per detection type (USD)
DETECTION_SURCHARGE = {
    "dead_pixel":  15.0,
    "black_spot":  20.0,
    "crack":       10.0,
    "shatter":     25.0,
    "damage":      10.0,   # generic fallback label
}


def estimate_repair_cost(
    damage_score: float,
    phone_model: str,
    detections: list[dict],
) -> float:
    """
    Estimate repair cost in USD.

    Formula:
        cost = (BASE_COST × model_weight × damage_factor) + detection_surcharges

    Args:
        damage_score:  0–100 numeric damage score from severity module
        phone_model:   key from PHONE_MODEL_COST_WEIGHTS (e.g. "iphone_14")
        detections:    list of detection dicts with "label" key

    Returns:
        Estimated cost in USD, rounded to 2 decimal places.
    """
    # --- Model weight ---
    model_key = (phone_model or "other").lower().replace(" ", "_").replace("-", "_")
    model_weight = PHONE_MODEL_COST_WEIGHTS.get(model_key, PHONE_MODEL_COST_WEIGHTS["other"])

    # --- Damage factor (0.2 – 1.0 scale so even low damage has some cost) ---
    damage_factor = 0.2 + (damage_score / 100.0) * 0.8

    # --- Base calculation ---
    base = BASE_REPAIR_COST_USD * model_weight * damage_factor

    # --- Per-detection surcharges (capped at 5 detections to avoid runaway) ---
    surcharge = 0.0
    for det in detections[:5]:
        label = det.get("label", "damage").lower()
        surcharge += DETECTION_SURCHARGE.get(label, 10.0)

    total = round(base + surcharge, 2)

    logger.info(
        f"Cost estimate: ${total} "
        f"(model={model_key}, weight={model_weight}, "
        f"damage_factor={damage_factor:.2f}, surcharge=${surcharge})"
    )
    return total

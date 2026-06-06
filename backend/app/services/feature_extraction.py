import numpy as np
from typing import List, Dict


def extract_features(mask: np.ndarray, detections: List[Dict]) -> np.ndarray:
    """
    Extract a numerical feature vector from segmentation mask and detections.
    Used as input for the severity classifier.
    """
    # Mask features
    total_pixels = mask.size or 1
    damage_ratio = float(mask.sum()) / total_pixels
    damage_area = float(mask.sum())

    # Detection features
    num_detections = len(detections)
    avg_confidence = (
        np.mean([d["confidence"] for d in detections]) if detections else 0.0
    )
    max_confidence = (
        np.max([d["confidence"] for d in detections]) if detections else 0.0
    )

    return np.array([
        damage_ratio,
        damage_area,
        float(num_detections),
        avg_confidence,
        max_confidence,
    ], dtype=np.float32)

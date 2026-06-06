"""
Dead Pixel Detection using OpenCV
No training needed — uses image processing rules.

Dead pixels appear as:
- Pure black dots (dead pixels)
- Stuck bright dots (stuck pixels — always red/green/blue)
- Small dark clusters (partial dead zones)
"""

import cv2
import numpy as np
import logging


logger = logging.getLogger(__name__)


def detect_dead_pixels(image_bytes: bytes) -> list[dict]:
    """
    Detect dead pixels and black spots in screen image.

    Returns list of detections:
    [
        {
            "label": "dead_pixel",
            "confidence": 0.85,
            "bbox": [x, y, w, h],   normalized 0-1
            "pixel_count": 3
        }
    ]
    """
    # Load image
    img_array = np.frombuffer(image_bytes, dtype=np.uint8)
    img       = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        return []

    h, w = img.shape[:2]
    detections = []

    # ── Method 1: Pure black pixel clusters (dead pixels) ─────────
    gray        = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Very dark pixels (< 15 brightness) = dead pixels
    dead_mask   = (gray < 15).astype(np.uint8) * 255
    # Remove large dark areas (bezels, borders) — keep only small dots
    kernel      = np.ones((3,3), np.uint8)
    dead_mask   = cv2.morphologyEx(dead_mask, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(dead_mask, cv2.RETR_EXTERNAL,
                                   cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        area = cv2.contourArea(cnt)
        # Dead pixels: 1-50 pixels area
        if 1 <= area <= 50:
            x, y, bw, bh = cv2.boundingRect(cnt)
            confidence   = min(0.95, 0.6 + (50 - area) / 100)
            detections.append({
                "label":       "dead_pixel",
                "confidence":  round(confidence, 2),
                "bbox":        [x/w, y/h, bw/w, bh/h],
                "pixel_count": int(area),
            })

    # ── Method 2: Black spots (larger dead zones 50-500px) ────────
    black_mask  = (gray < 25).astype(np.uint8) * 255
    kernel2     = np.ones((5,5), np.uint8)
    black_mask  = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, kernel2)

    contours2, _ = cv2.findContours(black_mask, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours2:
        area = cv2.contourArea(cnt)
        if 50 < area <= 500:
            x, y, bw, bh = cv2.boundingRect(cnt)
            confidence   = min(0.90, 0.5 + area / 1000)
            detections.append({
                "label":       "black_spot",
                "confidence":  round(confidence, 2),
                "bbox":        [x/w, y/h, bw/w, bh/h],
                "pixel_count": int(area),
            })

    # ── Method 3: Stuck pixels (always one color) ─────────────────
    b, g, r = cv2.split(img)
    # Stuck red pixel: very red, not green or blue
    stuck_red  = ((r > 200) & (g < 50) & (b < 50)).astype(np.uint8) * 255
    # Stuck green pixel
    stuck_green = ((g > 200) & (r < 50) & (b < 50)).astype(np.uint8) * 255
    # Stuck blue pixel
    stuck_blue  = ((b > 200) & (r < 50) & (g < 50)).astype(np.uint8) * 255

    for mask, label in [
        (stuck_red,   "stuck_red_pixel"),
        (stuck_green, "stuck_green_pixel"),
        (stuck_blue,  "stuck_blue_pixel"),
    ]:
        mask    = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        conts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)
        for cnt in conts:
            area = cv2.contourArea(cnt)
            if 1 <= area <= 30:
                x, y, bw, bh = cv2.boundingRect(cnt)
                detections.append({
                    "label":       label,
                    "confidence":  0.80,
                    "bbox":        [x/w, y/h, bw/w, bh/h],
                    "pixel_count": int(area),
                })

    # Cap at 20 detections
    detections = sorted(detections,
                        key=lambda d: d["confidence"],
                        reverse=True)[:20]

    logger.info(f'Dead pixel detection: {len(detections)} found')
    return detections


def count_dead_pixels(image_bytes: bytes) -> dict:
    """
    Returns summary statistics for dead pixel analysis.
    """
    detections = detect_dead_pixels(image_bytes)
    return {
        "total":        len(detections),
        "dead_pixels":  sum(1 for d in detections if d["label"] == "dead_pixel"),
        "black_spots":  sum(1 for d in detections if d["label"] == "black_spot"),
        "stuck_pixels": sum(1 for d in detections
                           if "stuck" in d["label"]),
        "detections":   detections,
    }
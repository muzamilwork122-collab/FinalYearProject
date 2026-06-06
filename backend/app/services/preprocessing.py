"""
Image Preprocessing Pipeline
==============================
Steps:
  1. Auto-detect and crop the phone screen region from the photo
  2. Reduce glare / reflection
  3. Resize to 224×224
  4. Normalize with ImageNet mean/std
  5. Return PyTorch tensor (1, 3, 224, 224)

This means users can take a photo of the whole phone —
the system automatically finds and crops just the screen.
"""

import io
import logging
import numpy as np
import cv2
import torch
from PIL import Image

logger = logging.getLogger(__name__)

IMAGE_SIZE = (224, 224)
MEAN       = [0.485, 0.456, 0.406]   # ImageNet mean
STD        = [0.229, 0.224, 0.225]   # ImageNet std


# ── Main entry point ───────────────────────────────────────────────────────

def preprocess_image(image_bytes: bytes) -> torch.Tensor:
    """
    Full preprocessing pipeline.
    Returns tensor of shape (1, 3, 224, 224) ready for model inference.
    """
    # Step 1: Load image
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_array = np.array(pil_image)                  # H x W x 3, uint8

    # Step 2: Auto-crop screen region
    cropped   = auto_crop_screen(img_array)

    # Step 3: Reduce glare
    deglared  = reduce_glare(cropped)

    # Step 4: Resize to model input size
    resized   = cv2.resize(deglared, IMAGE_SIZE, interpolation=cv2.INTER_LINEAR)

    # Step 5: Normalize + convert to tensor
    arr       = resized.astype(np.float32) / 255.0
    arr       = (arr - MEAN) / STD
    tensor    = torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0)  # (1,3,H,W)

    return tensor


# ── Step 2: Auto screen crop ───────────────────────────────────────────────

def auto_crop_screen(img: np.ndarray) -> np.ndarray:
    """
    Automatically detect and crop the phone screen region.

    Strategy:
    1. Convert to grayscale
    2. Apply edge detection (Canny)
    3. Find contours
    4. Pick the largest rectangular contour that looks like a screen
    5. Apply perspective transform to get a flat, straight crop
    6. Fall back to center crop if no screen found

    Returns cropped screen region as numpy array (RGB).
    """
    original_h, original_w = img.shape[:2]

    try:
        # ── Convert to grayscale ───────────────────────────────────────────
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

        # ── Blur to reduce noise ───────────────────────────────────────────
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)

        # ── Edge detection ─────────────────────────────────────────────────
        edges = cv2.Canny(blurred, 30, 100)

        # ── Dilate edges to close small gaps ──────────────────────────────
        kernel  = np.ones((3, 3), np.uint8)
        dilated = cv2.dilate(edges, kernel, iterations=2)

        # ── Find contours ──────────────────────────────────────────────────
        contours, _ = cv2.findContours(
            dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        if not contours:
            logger.debug("No contours found — using full image")
            return img

        # ── Sort by area (largest first) ───────────────────────────────────
        contours = sorted(contours, key=cv2.contourArea, reverse=True)

        screen_crop = None

        for contour in contours[:5]:   # check top 5 largest contours
            area = cv2.contourArea(contour)

            # Skip if too small (< 10% of image area)
            min_area = 0.10 * original_h * original_w
            if area < min_area:
                continue

            # Approximate contour to polygon
            peri    = cv2.arcLength(contour, True)
            approx  = cv2.approxPolyDP(contour, 0.02 * peri, True)

            # ── 4-point polygon = rectangle = likely screen ────────────────
            if len(approx) == 4:
                screen_crop = four_point_transform(img, approx.reshape(4, 2))
                logger.info(
                    f"Screen detected via 4-point contour — "
                    f"area={area:.0f} ({area/(original_h*original_w)*100:.1f}% of image)"
                )
                break

            # ── Try bounding rect for non-perfect rectangles ───────────────
            elif len(approx) <= 8:
                x, y, w, h = cv2.boundingRect(approx)
                aspect     = w / h if h > 0 else 0

                # Phone screens are between 0.4 and 0.8 aspect ratio (portrait)
                # or 1.2 to 2.5 (landscape)
                if (0.35 <= aspect <= 0.85) or (1.2 <= aspect <= 2.6):
                    # Add small padding
                    pad = 10
                    x1  = max(0, x - pad)
                    y1  = max(0, y - pad)
                    x2  = min(original_w, x + w + pad)
                    y2  = min(original_h, y + h + pad)
                    screen_crop = img[y1:y2, x1:x2]
                    logger.info(
                        f"Screen detected via bounding rect — "
                        f"aspect={aspect:.2f} size={w}x{h}"
                    )
                    break

        if screen_crop is not None and screen_crop.size > 0:
            return screen_crop

        # ── Fallback: center crop (remove 15% border on each side) ─────────
        logger.debug("No screen contour matched — using center crop fallback")
        return center_crop(img, margin=0.12)

    except Exception as e:
        logger.warning(f"Screen crop failed ({e}) — using original image")
        return img


def four_point_transform(img: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """
    Apply perspective transform to straighten a 4-point region.
    Corrects photos taken at an angle.
    """
    # Order points: top-left, top-right, bottom-right, bottom-left
    rect   = order_points(pts)
    tl, tr, br, bl = rect

    # Compute output width
    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_w   = max(int(width_a), int(width_b))

    # Compute output height
    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_h    = max(int(height_a), int(height_b))

    if max_w < 10 or max_h < 10:
        return img   # degenerate case

    # Destination points
    dst = np.array([
        [0,         0        ],
        [max_w - 1, 0        ],
        [max_w - 1, max_h - 1],
        [0,         max_h - 1],
    ], dtype=np.float32)

    M       = cv2.getPerspectiveTransform(rect.astype(np.float32), dst)
    warped  = cv2.warpPerspective(img, M, (max_w, max_h))
    return warped


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    Order 4 points as: top-left, top-right, bottom-right, bottom-left.
    """
    rect = np.zeros((4, 2), dtype=np.float32)
    s    = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)

    rect[0] = pts[np.argmin(s)]      # top-left     (smallest sum)
    rect[2] = pts[np.argmax(s)]      # bottom-right (largest sum)
    rect[1] = pts[np.argmin(diff)]   # top-right    (smallest diff)
    rect[3] = pts[np.argmax(diff)]   # bottom-left  (largest diff)

    return rect


def center_crop(img: np.ndarray, margin: float = 0.12) -> np.ndarray:
    """
    Crop out a border margin from all sides.
    margin=0.12 means remove 12% from each edge.
    """
    h, w = img.shape[:2]
    y1   = int(h * margin)
    y2   = int(h * (1 - margin))
    x1   = int(w * margin)
    x2   = int(w * (1 - margin))
    return img[y1:y2, x1:x2]


# ── Step 3: Glare reduction ────────────────────────────────────────────────

def reduce_glare(img: np.ndarray) -> np.ndarray:
    """
    Reduce glare and reflections on phone screens.

    Strategy:
    - Convert to LAB color space (separates luminance from color)
    - Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
      to the L (lightness) channel only
    - This enhances contrast in dark crack areas without blowing out
      bright reflections
    """
    try:
        # Convert RGB → LAB
        lab   = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)

        # Apply CLAHE to L channel only
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_eq  = clahe.apply(l)

        # Merge back and convert to RGB
        lab_eq  = cv2.merge([l_eq, a, b])
        result  = cv2.cvtColor(lab_eq, cv2.COLOR_LAB2RGB)

        return result

    except Exception as e:
        logger.warning(f"Glare reduction failed ({e}) — using original")
        return img
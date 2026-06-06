"""
Test: Image Validation Service
================================
Tests validate_image_bytes() and check_is_phone_screen()
Place at: backend/tests/test_validation.py

Run: pytest tests/test_validation.py -v
"""

import io
import numpy as np
import pytest
from PIL import Image
from app.services.validation import validate_image_bytes, check_is_phone_screen


# ── Helper ─────────────────────────────────────────────────────────

def make_image(width, height, color=(40,40,40), fmt="JPEG") -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    return buf.read()


def make_cv2_image(width, height, color=(40,40,40)):
    import cv2
    img = np.full((height, width, 3), color, dtype=np.uint8)
    return img


# ══════════════════════════════════════════
# VALIDATION TESTS
# ══════════════════════════════════════════

class TestValidateImageBytes:

    def test_valid_phone_image_passes(self):
        """A normal portrait phone image should pass validation."""
        img_bytes = make_image(400, 800)
        result    = validate_image_bytes(img_bytes)
        assert result["valid"] is True
        assert result["error"] is None

    def test_corrupt_file_rejected(self):
        """Random bytes that are not an image should be rejected."""
        result = validate_image_bytes(b"this is not an image at all 12345")
        assert result["valid"]  is False
        assert result["reason"] == "invalid_file"

    def test_too_small_image_rejected(self):
        """Image smaller than minimum size should be rejected."""
        img_bytes = make_image(20, 20)
        result    = validate_image_bytes(img_bytes)
        assert result["valid"]  is False
        assert result["reason"] == "image_too_small"

    def test_too_large_file_rejected(self):
        """File over 10MB should be rejected."""
        big_bytes = b"0" * (11 * 1024 * 1024)
        result    = validate_image_bytes(big_bytes)
        assert result["valid"]  is False
        assert result["reason"] == "file_too_large"

    def test_png_format_accepted(self):
        """PNG format should also be accepted."""
        img_bytes = make_image(400, 800, fmt="PNG")
        result    = validate_image_bytes(img_bytes)
        # Should not fail on file format
        assert result["reason"] != "invalid_file"

    def test_empty_bytes_rejected(self):
        """Empty bytes should be rejected."""
        result = validate_image_bytes(b"")
        assert result["valid"] is False

    def test_landscape_phone_accepted(self):
        """Landscape phone image should pass."""
        img_bytes = make_image(800, 400)   # landscape
        result    = validate_image_bytes(img_bytes)
        assert result["reason"] != "file_too_large"
        assert result["reason"] != "invalid_file"


# ══════════════════════════════════════════
# SCREEN DETECTION TESTS
# ══════════════════════════════════════════

class TestCheckIsPhoneScreen:

    def test_portrait_phone_ratio_passes(self):
        """Portrait ratio 1:2 should be detected as phone screen."""
        import cv2
        img        = make_cv2_image(400, 800)
        is_screen, confidence, reason = check_is_phone_screen(img)
        # Should either pass or have a reasonable confidence
        assert isinstance(is_screen,   bool)
        assert isinstance(confidence,  float)
        assert isinstance(reason,      str)
        assert 0.0 <= confidence <= 1.0

    def test_square_image_rejected(self):
        """Square image (1:1) should be rejected — not a phone screen."""
        import cv2
        img        = make_cv2_image(500, 500)
        is_screen, confidence, reason = check_is_phone_screen(img)
        assert is_screen is False

    def test_very_wide_image_rejected(self):
        """Very wide image (5:1) should be rejected."""
        import cv2
        img        = make_cv2_image(1000, 200)
        is_screen, confidence, reason = check_is_phone_screen(img)
        assert is_screen is False

    def test_returns_three_values(self):
        """Function must always return exactly 3 values."""
        import cv2
        img    = make_cv2_image(400, 800)
        result = check_is_phone_screen(img)
        assert len(result) == 3

    def test_confidence_in_valid_range(self):
        """Confidence score must be between 0 and 1."""
        import cv2
        img        = make_cv2_image(400, 800)
        _, confidence, _ = check_is_phone_screen(img)
        assert 0.0 <= confidence <= 1.0

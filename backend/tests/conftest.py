"""
conftest.py — Shared test fixtures used across all test files.
Place at: backend/tests/conftest.py
"""
import os
os.environ["TESTING"] = "true"
import os
import sys

# Set BEFORE anything else loads
os.environ["TESTING"] = "true"

# Force reload validation module with new env
if "app.services.validation" in sys.modules:
    del sys.modules["app.services.validation"]



import io
import pytest
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient



# ── Create test images ─────────────────────────────────────────────




def make_tiny_image_bytes() -> bytes:
    """Create an image that is too small."""
    img = Image.new("RGB", (30, 30), color=(100, 100, 100))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    return buf.read()


def make_large_image_bytes() -> bytes:
    """Create an image that exceeds size limit."""
    # 11MB of random data
    return b"0" * (11 * 1024 * 1024)


# ── Fixtures ───────────────────────────────────────────────────────

@pytest.fixture
def phone_image_bytes():
    """Valid phone screen image."""
    return make_image_bytes(width=400, height=800, color=(40, 40, 40))


@pytest.fixture
def cracked_image_bytes():
    """Phone screen image with simulated crack."""
    return make_image_bytes(width=400, height=800, add_crack=True)


@pytest.fixture
def tiny_image_bytes():
    """Image too small to be valid."""
    return make_tiny_image_bytes()


@pytest.fixture
def large_file_bytes():
    """File too large."""
    return make_large_image_bytes()


@pytest.fixture
def client():
    """FastAPI test client with rate limiting disabled."""
    from app.main import app
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    from unittest.mock import patch

    # Disable rate limiter during tests
    with patch("app.api.routes.predict.limiter.limit",
               return_value=lambda f: f):
        from fastapi.testclient import TestClient
        with TestClient(app) as c:
            yield c

@pytest.fixture
def auth_token(client):
    """Create a test user and return auth token."""
    # Sign up
    resp = client.post("/api/auth/signup", json={
        "name":     "Test User",
        "email":    "testuser@screenai.test",
        "password": "Testpass123!"
    })
    if resp.status_code == 409:
        # Already exists — login instead
        resp = client.post("/api/auth/login", json={
            "email":    "testuser@screenai.test",
            "password": "Testpass123!"
        })
    assert resp.status_code == 200
    return resp.json()["token"]

def make_image_bytes(width=400, height=800, color=(40,40,40), add_crack=False) -> bytes:
    """Create a realistic-looking phone screen test image."""
    import cv2
    import numpy as np

    # Create dark background (phone bezel)
    img = np.full((height, width, 3), 20, dtype=np.uint8)

    # Add lighter screen area in center (simulates actual screen)
    border = int(width * 0.05)
    screen = img[border:height-border, border:width-border]
    screen[:] = color

    # Add some variation to look like screen content
    noise = np.random.randint(0, 30, screen.shape, dtype=np.uint8)
    screen = cv2.add(screen, noise)
    img[border:height-border, border:width-border] = screen

    # Add crack line if requested
    if add_crack:
        cv2.line(img, (50, 100), (350, 700), (200, 200, 200), 2)

    buf = io.BytesIO()
    Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(buf, format="JPEG", quality=95)
    buf.seek(0)
    return buf.read()
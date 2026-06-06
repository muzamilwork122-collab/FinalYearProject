import base64
import io
import numpy as np
from PIL import Image
from typing import List, Dict


def encode_image_base64(image_bytes: bytes, format: str = "JPEG") -> str:
    """Convert raw bytes to a base64 data URL."""
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    mime = "image/jpeg" if format.upper() == "JPEG" else "image/png"
    return f"data:{mime};base64,{b64}"


def overlay_mask_on_image(image_bytes: bytes, mask: np.ndarray) -> bytes:
    """
    Draw a red semi-transparent overlay on the damage mask region.
    Returns JPEG bytes of the annotated image.
    """
    image = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))

    mask_resized = Image.fromarray((mask * 180).astype(np.uint8)).resize(image.size)
    red_layer = Image.new("RGBA", image.size, (239, 68, 68, 0))
    red_layer.putalpha(mask_resized)
    overlay = Image.alpha_composite(overlay, red_layer)

    result = Image.alpha_composite(image, overlay).convert("RGB")
    buf = io.BytesIO()
    result.save(buf, format="JPEG", quality=90)
    return buf.getvalue()

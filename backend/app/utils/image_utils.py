from PIL import Image
import io


def validate_image_bytes(data: bytes, max_mb: int = 10) -> None:
    """Raise ValueError if image is too large or invalid."""
    if len(data) > max_mb * 1024 * 1024:
        raise ValueError(f"Image exceeds {max_mb}MB limit")
    try:
        Image.open(io.BytesIO(data)).verify()
    except Exception:
        raise ValueError("Invalid or corrupted image file")


def get_image_dimensions(data: bytes) -> tuple[int, int]:
    """Return (width, height) of an image from bytes."""
    img = Image.open(io.BytesIO(data))
    return img.size

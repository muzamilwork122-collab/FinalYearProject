import logging
import numpy as np
import torch

from app.models.model_loader import get_model

logger = logging.getLogger(__name__)


def run_segmentation(tensor: torch.Tensor) -> np.ndarray:
    """
    Run segmentation model on a preprocessed image tensor.
    Returns a binary mask (H x W) as a numpy array.
    """
    model = get_model("segmentation")
    if model is None:
        logger.warning("Segmentation model not loaded — returning empty mask")
        h, w = tensor.shape[-2], tensor.shape[-1]
        return np.zeros((h, w), dtype=np.uint8)

    with torch.no_grad():
        output = model(tensor.float())  # ✅ .float() fixes Double vs Float mismatch
        mask = torch.sigmoid(output).squeeze().cpu().numpy()
        return (mask > 0.5).astype(np.uint8)
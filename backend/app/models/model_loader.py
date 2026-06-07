import logging
import pickle
from pathlib import Path

import torch

from app.core.config import settings

logger = logging.getLogger(__name__)

_models = {}



def load_all_models():
    """Load all models into memory at startup."""
    _load_torch_model("segmentation", settings.SEGMENTATION_MODEL_PATH)
    _load_torch_model("detection", settings.DETECTION_MODEL_PATH)
    _load_sklearn_model("severity", settings.SEVERITY_MODEL_PATH)


import segmentation_models_pytorch as smp

def _load_torch_model(name: str, path: str):
    p = Path(path)
    if not p.exists():
        logger.warning(f"[{name}] Model file not found at {path} — using None")
        _models[name] = None
        return
    try:
        if name == "segmentation":
            model = smp.Unet(
                encoder_name="resnet34",      # match what you used in Colab
                encoder_weights=None,
                in_channels=3,
                classes=1,
                activation=None                                        # match your number of output classes
            )
            state_dict = torch.load(p, map_location="cpu")
            # Handle if the file is a full model or a state_dict
            if isinstance(state_dict, dict):
                model.load_state_dict(state_dict)
            else:
                model.load_state_dict(state_dict.state_dict())
            model.eval()
            _models[name] = model
        else:
            _models[name] = torch.load(p, map_location="cpu")
            _models[name].eval()
        logger.info(f"[{name}] Loaded from {path}")
    except Exception as e:
        logger.error(f"[{name}] Failed to load: {e}")
        _models[name] = None

def _load_sklearn_model(name: str, path: str):
    p = Path(path)
    if not p.exists():
        logger.warning(f"[{name}] Model file not found at {path} — using None")
        _models[name] = None
        return
    try:
        with open(p, "rb") as f:
            _models[name] = pickle.load(f)
        logger.info(f"[{name}] Loaded from {path}")
    except Exception as e:
        logger.error(f"[{name}] Failed to load: {e}")
        _models[name] = None


def get_model(name: str):
    return _models.get(name)
    




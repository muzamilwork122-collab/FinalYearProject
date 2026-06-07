import logging
import pickle
from pathlib import Path
import torch
from app.core.config import settings

logger = logging.getLogger(__name__)
_models = {}


def _resolve_path(config_path: str, filename: str) -> Path:
    """
    Resolve model file path.
    Tries config path first, then falls back to known Railway location.
    """
    # Try 1: exactly what config says
    p = Path(config_path)
    if p.exists():
        return p

    # Try 2: relative to cwd (works if cwd is /app and path is models_weights/x.pt)
    p2 = Path.cwd() / config_path
    if p2.exists():
        return p2

    # Try 3: hardcoded Railway absolute path — /app/models_weights/filename
    p3 = Path("/app") / "models_weights" / filename
    if p3.exists():
        return p3

    # Try 4: relative to THIS file going up to repo root
    # /app/app/models/model_loader.py → 3 parents = /app/
    p4 = Path(__file__).resolve().parent.parent.parent / "models_weights" / filename
    if p4.exists():
        return p4

    # Nothing found — return config path so the error message is informative
    return p


def load_all_models():
    """Load all models into memory at startup."""
    seg_path = _resolve_path(settings.SEGMENTATION_MODEL_PATH, "segmentation.pt")
    det_path = _resolve_path(settings.DETECTION_MODEL_PATH,    "detection.pt")
    sev_path = _resolve_path(settings.SEVERITY_MODEL_PATH,     "severity.pkl")

    logger.info(f"Resolved segmentation path: {seg_path} (exists={seg_path.exists()})")
    logger.info(f"Resolved detection path:    {det_path} (exists={det_path.exists()})")
    logger.info(f"Resolved severity path:     {sev_path} (exists={sev_path.exists()})")

    _load_torch_model("segmentation", str(seg_path))
    _load_torch_model("detection",    str(det_path))
    _load_sklearn_model("severity",   str(sev_path))


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
                encoder_name="resnet34",
                encoder_weights=None,
                in_channels=3,
                classes=1,
                activation=None
            )
            state_dict = torch.load(p, map_location="cpu")
            if isinstance(state_dict, dict):
                model.load_state_dict(state_dict)
            else:
                model.load_state_dict(state_dict.state_dict())
            model.eval()
            _models[name] = model
        else:
            _models[name] = torch.load(p, map_location="cpu")
            _models[name].eval()
        logger.info(f"[{name}] ✓ Loaded from {path}")
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
        logger.info(f"[{name}] ✓ Loaded from {path}")
    except Exception as e:
        logger.error(f"[{name}] Failed to load: {e}")
        _models[name] = None


def get_model(name: str):
    return _models.get(name)
import logging
import pickle
from pathlib import Path
import torch
from app.core.config import settings

logger = logging.getLogger(__name__)
_models = {}


def _resolve_path(config_path: str, filename: str) -> Path:
    """Try every possible location the model file could be at."""
    candidates = [
        Path(config_path),
        Path.cwd() / config_path,
        Path("/app") / "models_weights" / filename,
        Path("/app") / "backend" / "models_weights" / filename,
        Path(__file__).resolve().parent.parent.parent / "models_weights" / filename,
    ]
    for p in candidates:
        if p.exists():
            return p
    return Path(config_path)


def load_all_models():
    """Load segmentation and severity models at startup. Detection not used."""
    seg_path = _resolve_path(settings.SEGMENTATION_MODEL_PATH, "segmentation.pt")
    sev_path = _resolve_path(settings.SEVERITY_MODEL_PATH,     "severity.pkl")

    logger.info(f"segmentation : {seg_path} (exists={seg_path.exists()})")
    logger.info(f"severity     : {sev_path} (exists={sev_path.exists()})")

    _load_torch_model("segmentation", str(seg_path))
    _load_sklearn_model("severity",   str(sev_path))

    # detection.pt not required for this project
    _models["detection"] = None
    logger.info("[detection] not required — skipped")


import segmentation_models_pytorch as smp


def _load_torch_model(name: str, path: str):
    p = Path(path)
    if not p.exists():
        logger.warning(f"[{name}] not found at {path} — skipping")
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
        logger.info(f"[{name}] ✓ loaded successfully")
    except Exception as e:
        logger.error(f"[{name}] failed to load: {e}")
        _models[name] = None


def _load_sklearn_model(name: str, path: str):
    p = Path(path)
    if not p.exists():
        logger.warning(f"[{name}] not found at {path} — skipping")
        _models[name] = None
        return
    try:
        with open(p, "rb") as f:
            _models[name] = pickle.load(f)
        logger.info(f"[{name}] ✓ loaded successfully")
    except Exception as e:
        logger.error(f"[{name}] failed to load: {e}")
        _models[name] = None


def get_model(name: str):
    return _models.get(name)
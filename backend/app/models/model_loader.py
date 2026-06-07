import logging
import pickle
from pathlib import Path
import torch
from app.core.config import settings

logger = logging.getLogger(__name__)
_models = {}
_paths  = {}   # store resolved paths for lazy loading


def _resolve_path(config_path: str, filename: str) -> Path:
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
    """
    Lazy loading — don't load models at startup.
    Just resolve and store the paths. Models load on first get_model() call.
    This avoids Railway OOM kills during startup.
    """
    _paths["segmentation"] = _resolve_path(settings.SEGMENTATION_MODEL_PATH, "segmentation.pt")
    _paths["severity"]     = _resolve_path(settings.SEVERITY_MODEL_PATH,     "severity.pkl")

    logger.info(f"[segmentation] path resolved: {_paths['segmentation']} (exists={_paths['segmentation'].exists()})")
    logger.info(f"[severity]     path resolved: {_paths['severity']} (exists={_paths['severity'].exists()})")
    logger.info("Models will load on first request (lazy loading — saves startup RAM)")

    # Mark as not yet loaded
    _models["segmentation"] = None
    _models["severity"]     = None
    _models["detection"]    = None   # not required


def get_model(name: str):
    """
    Returns model, loading it on first call (lazy).
    Thread-safe enough for single-worker Railway deployment.
    """
    # detection never needed
    if name == "detection":
        return None

    # Already loaded
    if _models.get(name) is not None:
        return _models[name]

    # Not loaded yet — load now
    path = _paths.get(name)
    if path is None:
        logger.error(f"[{name}] no path stored — was load_all_models() called?")
        return None

    logger.info(f"[{name}] lazy loading from {path}...")

    if name == "segmentation":
        _models["segmentation"] = _load_segmentation(path)
    elif name == "severity":
        _models["severity"] = _load_severity(path)

    return _models.get(name)


def _load_segmentation(path: Path):
    if not path.exists():
        logger.error(f"[segmentation] file not found: {path}")
        return None
    try:
        import segmentation_models_pytorch as smp
        import gc

        model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights=None,
            in_channels=3,
            classes=1,
            activation=None
        )

        # weights_only=True is more memory efficient (PyTorch 2.x)
        try:
            state_dict = torch.load(str(path), map_location="cpu", weights_only=True)
        except Exception:
            state_dict = torch.load(str(path), map_location="cpu", weights_only=False)

        if isinstance(state_dict, dict) and not hasattr(state_dict, 'parameters'):
            model.load_state_dict(state_dict, strict=False)
        else:
            model.load_state_dict(state_dict.state_dict(), strict=False)

        model.eval()
        del state_dict
        gc.collect()

        logger.info("[segmentation] ✓ lazy loaded successfully")
        return model

    except MemoryError:
        logger.error("[segmentation] OUT OF MEMORY during lazy load")
        return None
    except Exception as e:
        logger.error(f"[segmentation] failed: {type(e).__name__}: {e}")
        return None


def _load_severity(path: Path):
    if not path.exists():
        logger.error(f"[severity] file not found: {path}")
        return None
    try:
        with open(str(path), "rb") as f:
            model = pickle.load(f)
        logger.info("[severity] ✓ lazy loaded successfully")
        return model
    except Exception as e:
        logger.error(f"[severity] failed: {type(e).__name__}: {e}")
        return None
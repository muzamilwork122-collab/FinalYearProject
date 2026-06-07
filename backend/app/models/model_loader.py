import logging
import pickle
from pathlib import Path
import torch
from app.core.config import settings

logger = logging.getLogger(__name__)
_models = {}


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
    """Load segmentation and severity models. Detection not used."""

    seg_path = _resolve_path(settings.SEGMENTATION_MODEL_PATH, "segmentation.pt")
    sev_path = _resolve_path(settings.SEVERITY_MODEL_PATH,     "severity.pkl")

    logger.info(f"segmentation : {seg_path} (exists={seg_path.exists()})")
    logger.info(f"severity     : {sev_path} (exists={sev_path.exists()})")

    # ── Load segmentation ──────────────────────────────────
    logger.info("Loading segmentation model...")
    try:
        _load_segmentation(str(seg_path))
        logger.info("[segmentation] ✓ done")
    except Exception as e:
        logger.error(f"[segmentation] CRASHED: {type(e).__name__}: {e}")
        _models["segmentation"] = None

    # ── Load severity ──────────────────────────────────────
    logger.info("Loading severity model...")
    try:
        _load_severity(str(sev_path))
        logger.info("[severity] ✓ done")
    except Exception as e:
        logger.error(f"[severity] CRASHED: {type(e).__name__}: {e}")
        _models["severity"] = None

    # ── Detection not needed ───────────────────────────────
    _models["detection"] = None
    logger.info("[detection] skipped — not required")

    logger.info("Model loading complete.")


def _load_segmentation(path: str):
    p = Path(path)
    if not p.exists():
        logger.warning(f"[segmentation] file not found: {path}")
        _models["segmentation"] = None
        return

    # Log file size — helps diagnose memory issues
    size_mb = p.stat().st_size / 1024 / 1024
    logger.info(f"[segmentation] file size: {size_mb:.1f} MB")

    try:
        import segmentation_models_pytorch as smp
        logger.info("[segmentation] building smp.Unet architecture...")
        model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights=None,
            in_channels=3,
            classes=1,
            activation=None
        )
        logger.info("[segmentation] loading state dict from disk...")
        state_dict = torch.load(p, map_location="cpu")
        logger.info(f"[segmentation] state_dict type: {type(state_dict)}")

        if isinstance(state_dict, dict):
            model.load_state_dict(state_dict)
        else:
            model.load_state_dict(state_dict.state_dict())

        model.eval()
        _models["segmentation"] = model
        logger.info("[segmentation] ✓ loaded successfully")

    except MemoryError as e:
        logger.error(f"[segmentation] OUT OF MEMORY: {e}")
        _models["segmentation"] = None
    except RuntimeError as e:
        logger.error(f"[segmentation] RuntimeError (likely architecture mismatch): {e}")
        _models["segmentation"] = None
    except Exception as e:
        logger.error(f"[segmentation] Unexpected error {type(e).__name__}: {e}")
        _models["segmentation"] = None


def _load_severity(path: str):
    p = Path(path)
    if not p.exists():
        logger.warning(f"[severity] file not found: {path}")
        _models["severity"] = None
        return

    size_mb = p.stat().st_size / 1024 / 1024
    logger.info(f"[severity] file size: {size_mb:.1f} MB")

    try:
        with open(p, "rb") as f:
            _models["severity"] = pickle.load(f)
        logger.info("[severity] ✓ loaded successfully")
    except Exception as e:
        logger.error(f"[severity] error: {type(e).__name__}: {e}")
        _models["severity"] = None


def get_model(name: str):
    return _models.get(name)
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
    seg_path = _resolve_path(settings.SEGMENTATION_MODEL_PATH, "segmentation.pt")
    sev_path = _resolve_path(settings.SEVERITY_MODEL_PATH,     "severity.pkl")

    logger.info(f"segmentation : {seg_path} (exists={seg_path.exists()})")
    logger.info(f"severity     : {sev_path} (exists={sev_path.exists()})")

    logger.info("Loading segmentation model...")
    try:
        _load_segmentation(str(seg_path))
    except Exception as e:
        logger.error(f"[segmentation] CRASHED: {type(e).__name__}: {e}")
        _models["segmentation"] = None

    logger.info("Loading severity model...")
    try:
        _load_severity(str(sev_path))
    except Exception as e:
        logger.error(f"[severity] CRASHED: {type(e).__name__}: {e}")
        _models["severity"] = None

    _models["detection"] = None
    logger.info("[detection] skipped — not required")
    logger.info("Model loading complete.")


def _load_segmentation(path: str):
    p = Path(path)
    if not p.exists():
        _models["segmentation"] = None
        return

    import segmentation_models_pytorch as smp
    import gc

    logger.info("[segmentation] building architecture...")
    model = smp.Unet(
        encoder_name="resnet34",
        encoder_weights=None,
        in_channels=3,
        classes=1,
        activation=None
    )

    logger.info("[segmentation] loading weights (memory-efficient)...")

    # ── Memory-efficient loading ───────────────────────────
    # weights_only=True skips unpickling — uses less RAM
    # map_location="cpu" ensures no GPU memory used
    try:
        # Try weights_only first (safest + most memory efficient, PyTorch 2.x)
        state_dict = torch.load(
            str(p),
            map_location=torch.device("cpu"),
            weights_only=True
        )
        logger.info("[segmentation] loaded with weights_only=True")
    except Exception as e1:
        logger.warning(f"[segmentation] weights_only failed ({e1}), trying standard load...")
        try:
            # Fallback for older PyTorch or full model saves
            state_dict = torch.load(
                str(p),
                map_location=torch.device("cpu"),
                weights_only=False
            )
            logger.info("[segmentation] loaded with weights_only=False")
        except Exception as e2:
            logger.error(f"[segmentation] both load attempts failed: {e2}")
            _models["segmentation"] = None
            return

    logger.info(f"[segmentation] state_dict type: {type(state_dict)}")

    # Load into model
    if isinstance(state_dict, dict) and not hasattr(state_dict, 'parameters'):
        missing, unexpected = model.load_state_dict(state_dict, strict=False)
        if missing:
            logger.warning(f"[segmentation] missing keys: {len(missing)}")
        if unexpected:
            logger.warning(f"[segmentation] unexpected keys: {len(unexpected)}")
    else:
        model.load_state_dict(state_dict.state_dict(), strict=False)

    model.eval()

    # Free state_dict from memory immediately
    del state_dict
    import gc
    gc.collect()

    _models["segmentation"] = model
    logger.info("[segmentation] ✓ loaded successfully")


def _load_severity(path: str):
    p = Path(path)
    if not p.exists():
        _models["severity"] = None
        return

    try:
        with open(p, "rb") as f:
            _models["severity"] = pickle.load(f)
        logger.info("[severity] ✓ loaded successfully")
    except Exception as e:
        logger.error(f"[severity] error: {type(e).__name__}: {e}")
        _models["severity"] = None


def get_model(name: str):
    return _models.get(name)
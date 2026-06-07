from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Model paths — absolute, works everywhere ──────────
    SEGMENTATION_MODEL_PATH: str = str(REPO_ROOT / "models_weights" / "segmentation.pt")
    DETECTION_MODEL_PATH:    str = str(REPO_ROOT / "models_weights" / "detection.pt")
    SEVERITY_MODEL_PATH:     str = str(REPO_ROOT / "models_weights" / "severity.pkl")

    # ── Your other existing settings below ────────────────
    # (keep everything else you already have in this file)

    class Config:
        env_file          = ".env"
        env_file_encoding = "utf-8"
        extra             = "ignore"


settings = Settings()

# Debug log so Railway logs show exact resolved paths
import logging
logger = logging.getLogger(__name__)
logger.info(f"REPO_ROOT              : {REPO_ROOT}")
logger.info(f"SEGMENTATION_MODEL_PATH: {settings.SEGMENTATION_MODEL_PATH}")
logger.info(f"DETECTION_MODEL_PATH   : {settings.DETECTION_MODEL_PATH}")
logger.info(f"SEVERITY_MODEL_PATH    : {settings.SEVERITY_MODEL_PATH}")
logger.info(f"segmentation.pt exists : {Path(settings.SEGMENTATION_MODEL_PATH).exists()}")
logger.info(f"detection.pt exists    : {Path(settings.DETECTION_MODEL_PATH).exists()}")
logger.info(f"severity.pkl exists    : {Path(settings.SEVERITY_MODEL_PATH).exists()}")
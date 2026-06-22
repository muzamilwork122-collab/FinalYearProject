from pydantic_settings import BaseSettings
from typing import List
from pathlib import Path

# Must be defined BEFORE the class — Pydantic evaluates defaults at class creation time
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
# /app/app/core/config.py
#       ↑ parent  = /app/app/core/
#              ↑ parent  = /app/app/
#                     ↑ parent  = /app/   ← repo root on Railway


class Settings(BaseSettings):
    APP_NAME:  str  = "mobile-damage-ai"
    DEBUG:     bool = False

    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # Absolute paths — works on Railway (/app) and locally
    SEGMENTATION_MODEL_PATH: str = str(_REPO_ROOT / "models_weights" / "segmentation.pt")
    DETECTION_MODEL_PATH:    str = str(_REPO_ROOT / "models_weights" / "detection.pt")
    SEVERITY_MODEL_PATH:     str = str(_REPO_ROOT / "models_weights" / "severity.pkl")

    CONFIDENCE_THRESHOLD: float = 0.5
    MAX_IMAGE_SIZE_MB:    int   = 10

    DATABASE_URL:      str = "postgresql://postgres:password@localhost:5432/damage_ai"
    OPENAI_API_KEY:    str = ""
    ANTHROPIC_API_KEY: str = ""
    FRONTEND_URL:      str = "http://localhost:5173"
    GOOGLE_CLIENT_ID:  str = ""

    # Signs stateless auth tokens so sessions survive server restarts.
    # Override in production via the SECRET_KEY env var.
    SECRET_KEY:        str = "dev-secret-change-me-in-production"

    # Default admin panel credentials (override via env in production).
    ADMIN_EMAIL:       str = "admin@dashboard.com"
    ADMIN_PASSWORD:    str = "Admin@123!"

    class Config:
        env_file          = ".env"
        env_file_encoding = "utf-8"
        extra             = "ignore"


settings = Settings()

if isinstance(settings.CORS_ORIGINS, str):
    settings.CORS_ORIGINS = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
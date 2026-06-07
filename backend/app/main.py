from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.routes.predict import router as predict_router
from app.api.routes.chat import router as chat_router
from app.api.routes.auth import router as auth_router
from app.models.model_loader import load_all_models
from app.db.database import create_tables
from app.db import models  # noqa: F401

setup_logging()

import os
# Disable rate limiting during tests
if os.getenv("TESTING") == "true":
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    
limiter = Limiter(key_func=get_remote_address, enabled=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()

    try:
        load_all_models()
    except Exception as e:
        print(f"Model loading failed: {e}")

    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

# ── Attach rate limiter to app ─────────────────────────────────────────────


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router, prefix="/api")
app.include_router(chat_router,   prefix="/api")
app.include_router(auth_router,   prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
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
from app.api.routes.shopkeeper import router as shopkeeper_router
from app.api.routes.admin import router as admin_router
from app.api.routes.chat_threads import router as chat_threads_router
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
    _seed_admin_account()
    print("Running in OpenAI-only mode — local models skipped")
    yield


def _seed_admin_account():
    """Ensure the single admin row exists (idempotent)."""
    from app.api.routes.admin import ensure_admin_account
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        ensure_admin_account(db)
    finally:
        db.close()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

# ── Attach rate limiter to app ─────────────────────────────────────────────


# Fully permissive CORS — allow every origin, method, and header.
# allow_origin_regex=".*" echoes the request's Origin back, which (unlike the
# "*" wildcard) also works for credentialed requests, so the browser never
# blocks an API call regardless of where the frontend is served from.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(predict_router,    prefix="/api")
app.include_router(chat_router,       prefix="/api")
app.include_router(auth_router,       prefix="/api")
app.include_router(shopkeeper_router, prefix="/api")
app.include_router(admin_router,      prefix="/api")
app.include_router(chat_threads_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}

@app.get("/debug/paths")
def debug_paths():
    import os
    from pathlib import Path
    return {
        "cwd":           os.getcwd(),
        "this_file":     str(Path(__file__).resolve()),
        "backend_exists": Path("/app/backend").exists(),
        "app_contents":  os.listdir("/app") if Path("/app").exists() else "no /app",
    }
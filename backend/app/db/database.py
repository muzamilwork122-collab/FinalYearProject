"""
Database setup using SQLAlchemy (async-compatible).

Tables:
  - analyses   : one row per prediction request
  - detections : one row per bounding-box detection within an analysis

Usage:
    from app.db.database import get_db, engine, Base
    # In route: async with get_db() as db: ...
"""

import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def create_tables():
    from app.db import models  # noqa — registers all models before create_all
    Base.metadata.create_all(bind=engine)
    _apply_lightweight_migrations()


# Columns added after the initial schema. `create_all` never alters existing
# tables, so add them idempotently here (Postgres `IF NOT EXISTS`). This keeps
# already-deployed databases in sync without a migration framework.
_COLUMN_ADDITIONS = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE shopkeepers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
    "ALTER TABLE admin_accounts ADD COLUMN IF NOT EXISTS avatar TEXT",
)


def _apply_lightweight_migrations():
    try:
        with engine.begin() as conn:
            for statement in _COLUMN_ADDITIONS:
                conn.execute(text(statement))
    except Exception as exc:  # never block startup on a best-effort migration
        logger.warning(f"Lightweight migration skipped: {exc}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

engine = create_engine(
    settings.DATABASE_URL,
    pool_size       = 10,    # maintain 10 connections
    max_overflow    = 20,    # allow 20 extra under load
    pool_pre_ping   = True,  # test connection before use
    pool_recycle    = 3600,  # recycle connections every hour
    echo            = False, # disable SQL logging in production
)
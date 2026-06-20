"""Admin module — a single platform administrator reviews shopkeeper
applications (approve / reject with reason), suspends/reactivates accounts, and
inspects platform data (users, shopkeepers, summary stats).

The admin account is seeded once from config defaults (ADMIN_EMAIL /
ADMIN_PASSWORD) into the `admin_accounts` table, then becomes self-editable:
the admin can change their own profile and password from the panel. Because of
that, sign-in and authorization validate against the database row, not config.
"""

import hashlib
import hmac
import logging
import os
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.api.routes.auth import (
    EMAIL_RE,
    FAKE_EMAIL_DOMAINS,
    hash_password,
    validate_name,
    validate_password,
    verify_password,
)
from app.core.config import settings
from app.db.database import get_db
from app.db.models import (
    SHOPKEEPER_STATUS_APPROVED,
    SHOPKEEPER_STATUS_PENDING,
    SHOPKEEPER_STATUS_REJECTED,
    AdminAccount,
    Analysis,
    Shopkeeper,
    User,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_limit = "1000/minute" if os.getenv("TESTING") == "true" else "10/minute"
limiter = Limiter(key_func=get_remote_address)

ALLOWED_STATUSES = {
    SHOPKEEPER_STATUS_PENDING,
    SHOPKEEPER_STATUS_APPROVED,
    SHOPKEEPER_STATUS_REJECTED,
}

ACTIVE_FILTERS = {"active", "inactive", "all"}
RECENT_ANALYSES_LIMIT = 10

# Profile picture is stored inline as a base64 data URL — keep it small.
MAX_AVATAR_BYTES = 2 * 1024 * 1024


def validate_admin_email(email: str) -> str:
    """Format-only email validation for the internal admin account.

    Unlike customer sign-up, this skips the DNS/MX deliverability check: the
    admin is a local operations account (it ships with a placeholder domain such
    as `admin@dashboard.com`) and never needs to receive mail to function.
    """
    cleaned = (email or "").strip().lower()
    if not EMAIL_RE.match(cleaned):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    domain = cleaned.rsplit("@", 1)[-1]
    if domain in FAKE_EMAIL_DOMAINS:
        raise HTTPException(status_code=400, detail=f'"{domain}" is not a valid email domain')
    return cleaned


def validate_avatar(avatar: str | None) -> str | None:
    """Accept a small base64 image data URL, or None/empty to remove it."""
    if not avatar:
        return None
    if not avatar.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Profile picture must be an image")
    # Rough decoded size from the base64 payload length (4 chars → 3 bytes).
    base64_part = avatar.split(",", 1)[-1]
    approx_bytes = (len(base64_part) * 3) // 4
    if approx_bytes > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Profile picture is too large (max 2MB)")
    return avatar


# ── Admin account bootstrap ────────────────────────────────────────────────

def ensure_admin_account(db: Session) -> AdminAccount:
    """Create the single admin row from config defaults if it doesn't exist."""
    admin = db.query(AdminAccount).first()
    if admin:
        return admin
    admin = AdminAccount(
        name="Administrator",
        email=settings.ADMIN_EMAIL.lower().strip(),
        password_hash=hash_password(settings.ADMIN_PASSWORD),
        created_at=datetime.utcnow(),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    logger.info("Seeded default admin account")
    return admin


# ── Stateless admin tokens ─────────────────────────────────────────────────
# Namespaced ("admin:<email>") so they can't be confused with other tokens.

def _sign_admin(email: str) -> str:
    payload = f"admin:{email}"
    return hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


def generate_admin_token(email: str) -> str:
    return f"admin:{email}.{_sign_admin(email)}"


def _resolve_admin_email(token: str) -> str | None:
    if not token or not token.startswith("admin:") or "." not in token:
        return None
    body, _, signature = token.rpartition(".")
    email = body[len("admin:"):]
    if not email or not signature:
        return None
    if not hmac.compare_digest(signature, _sign_admin(email)):
        return None
    return email


def require_admin(token: str, db: Session) -> AdminAccount:
    """Authenticate an admin token against the live account. The token's email
    must still match the stored admin email — so a profile email change forces a
    fresh sign-in (old tokens stop working)."""
    email = _resolve_admin_email(token)
    if not email:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    admin = ensure_admin_account(db)
    if not hmac.compare_digest(email, admin.email.lower()):
        raise HTTPException(status_code=401, detail="Admin session expired. Please sign in again.")
    return admin


# ── Request models ─────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    email: str
    password: str


class RejectRequest(BaseModel):
    token: str
    reason: str


class ActionRequest(BaseModel):
    token: str


class SetActiveRequest(BaseModel):
    token: str
    is_active: bool


class UpdateAdminProfileRequest(BaseModel):
    token: str
    name: str
    email: str
    # Always sent by the panel: a data URL to set, or null/"" to remove.
    avatar: str | None = None


class ChangeAdminPasswordRequest(BaseModel):
    token: str
    current_password: str
    new_password: str


# ── Auth ───────────────────────────────────────────────────────────────────

@router.post("/admin/login")
@limiter.limit(_limit)
def admin_login(request: Request, body: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = ensure_admin_account(db)
    email = (body.email or "").lower().strip()
    if not hmac.compare_digest(email, admin.email.lower()) or not verify_password(
        body.password or "", admin.password_hash
    ):
        raise HTTPException(status_code=401, detail="Incorrect admin email or password")
    token = generate_admin_token(admin.email.lower())
    logger.info("Admin signed in")
    return {"token": token, "admin": admin.to_dict()}


@router.get("/admin/profile")
def admin_profile(token: str, db: Session = Depends(get_db)):
    admin = require_admin(token, db)
    return admin.to_dict()


@router.patch("/admin/profile")
def update_admin_profile(body: UpdateAdminProfileRequest, db: Session = Depends(get_db)):
    admin = require_admin(body.token, db)
    admin.name = validate_name(body.name)
    admin.email = validate_admin_email(body.email)
    admin.avatar = validate_avatar(body.avatar)
    db.commit()
    db.refresh(admin)
    logger.info("Admin profile updated")
    # Email is part of the token payload, so always reissue a matching token.
    return {"token": generate_admin_token(admin.email.lower()), "admin": admin.to_dict()}


@router.post("/admin/change-password")
def change_admin_password(body: ChangeAdminPasswordRequest, db: Session = Depends(get_db)):
    admin = require_admin(body.token, db)
    if not verify_password(body.current_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    validate_password(body.new_password)
    if verify_password(body.new_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="New password must be different from the current one")
    admin.password_hash = hash_password(body.new_password)
    db.commit()
    logger.info("Admin password changed")
    return {"message": "Password changed successfully"}


# ── Stats ──────────────────────────────────────────────────────────────────

@router.get("/admin/stats")
def admin_stats(token: str, db: Session = Depends(get_db)):
    require_admin(token, db)
    return {
        "users":                db.query(User).count(),
        "users_inactive":       db.query(User).filter(User.is_active.is_(False)).count(),
        "analyses":             db.query(Analysis).count(),
        "shopkeepers_total":    db.query(Shopkeeper).count(),
        "shopkeepers_pending":  db.query(Shopkeeper).filter(Shopkeeper.status == SHOPKEEPER_STATUS_PENDING).count(),
        "shopkeepers_approved": db.query(Shopkeeper).filter(Shopkeeper.status == SHOPKEEPER_STATUS_APPROVED).count(),
        "shopkeepers_rejected": db.query(Shopkeeper).filter(Shopkeeper.status == SHOPKEEPER_STATUS_REJECTED).count(),
        "shopkeepers_inactive": db.query(Shopkeeper).filter(Shopkeeper.is_active.is_(False)).count(),
    }


# ── Shopkeepers ──────────────────────────────────────────────────────────────

@router.get("/admin/shopkeepers")
def list_shopkeepers(token: str, status: str | None = None, active: str | None = None, db: Session = Depends(get_db)):
    require_admin(token, db)
    query = db.query(Shopkeeper)
    if status:
        normalized = status.lower().strip()
        if normalized not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status filter")
        query = query.filter(Shopkeeper.status == normalized)
    if active and active.lower().strip() in {"active", "inactive"}:
        query = query.filter(Shopkeeper.is_active.is_(active.lower().strip() == "active"))
    shopkeepers = query.order_by(Shopkeeper.created_at.desc()).all()
    return [shop.to_admin_dict() for shop in shopkeepers]


def _load_shop(shop_id: str, db: Session) -> Shopkeeper:
    try:
        target = uuid.UUID(shop_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    shop = db.query(Shopkeeper).filter(Shopkeeper.id == target).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shopkeeper application not found")
    return shop


@router.post("/admin/shopkeepers/{shop_id}/approve")
def approve_shopkeeper(shop_id: str, body: ActionRequest, db: Session = Depends(get_db)):
    require_admin(body.token, db)
    shop = _load_shop(shop_id, db)
    if shop.status == SHOPKEEPER_STATUS_APPROVED:
        raise HTTPException(status_code=409, detail="Application is already approved")

    shop.status = SHOPKEEPER_STATUS_APPROVED
    shop.rejection_reason = None
    shop.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(shop)
    logger.info(f"Admin approved shopkeeper {shop.email} ({shop.shop_name})")
    return shop.to_admin_dict()


@router.post("/admin/shopkeepers/{shop_id}/reject")
def reject_shopkeeper(shop_id: str, body: RejectRequest, db: Session = Depends(get_db)):
    require_admin(body.token, db)
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A rejection reason is required")

    shop = _load_shop(shop_id, db)
    shop.status = SHOPKEEPER_STATUS_REJECTED
    shop.rejection_reason = reason
    shop.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(shop)
    logger.info(f"Admin rejected shopkeeper {shop.email} ({shop.shop_name})")
    return shop.to_admin_dict()


@router.post("/admin/shopkeepers/{shop_id}/active")
def set_shopkeeper_active(shop_id: str, body: SetActiveRequest, db: Session = Depends(get_db)):
    require_admin(body.token, db)
    shop = _load_shop(shop_id, db)
    shop.is_active = body.is_active
    db.commit()
    db.refresh(shop)
    logger.info(f"Admin {'activated' if body.is_active else 'deactivated'} shop {shop.email}")
    return shop.to_admin_dict()


# ── Users ────────────────────────────────────────────────────────────────────

def _user_summary(user: User) -> dict:
    return {
        "id":             str(user.id),
        "name":           user.name,
        "email":          user.email,
        "is_active":      user.is_active,
        "created_at":     user.created_at.isoformat() if user.created_at else None,
        "analyses_count": len(user.analyses),
    }


@router.get("/admin/users")
def list_users(token: str, active: str | None = None, db: Session = Depends(get_db)):
    require_admin(token, db)
    query = db.query(User)
    if active:
        normalized = active.lower().strip()
        if normalized not in ACTIVE_FILTERS:
            raise HTTPException(status_code=400, detail="Invalid active filter")
        if normalized != "all":
            query = query.filter(User.is_active.is_(normalized == "active"))
    users = query.order_by(User.created_at.desc()).all()
    return [_user_summary(user) for user in users]


@router.get("/admin/users/{user_id}")
def user_detail(user_id: str, token: str, db: Session = Depends(get_db)):
    require_admin(token, db)
    try:
        target = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    user = db.query(User).filter(User.id == target).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    recent = (
        db.query(Analysis)
        .filter(Analysis.user_id == target)
        .order_by(Analysis.created_at.desc())
        .limit(RECENT_ANALYSES_LIMIT)
        .all()
    )
    return {
        **_user_summary(user),
        "recent_analyses": [analysis.to_dict() for analysis in recent],
    }


@router.post("/admin/users/{user_id}/active")
def set_user_active(user_id: str, body: SetActiveRequest, db: Session = Depends(get_db)):
    require_admin(body.token, db)
    try:
        target = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    user = db.query(User).filter(User.id == target).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    logger.info(f"Admin {'activated' if body.is_active else 'deactivated'} user {user.email}")
    return _user_summary(user)

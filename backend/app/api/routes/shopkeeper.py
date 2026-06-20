"""Shopkeeper module — registration, authentication, and the public lookup
that feeds verified partner shops into the maps/shops locator.

A shopkeeper submits a 3-step application (account → shop details →
verification documents). The application starts in `pending` and is reviewed
by an admin (see admin.py). Only `approved` shops are exposed publicly.
"""

import hashlib
import hmac
import logging
import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.api.routes.auth import (
    hash_password,
    validate_email_address,
    validate_password,
    verify_password,
)
from app.core.config import settings
from app.db.database import get_db
from app.db.models import SHOPKEEPER_STATUS_APPROVED, Shopkeeper

logger = logging.getLogger(__name__)
router = APIRouter()

import os

_limit = "1000/minute" if os.getenv("TESTING") == "true" else "5/minute"
limiter = Limiter(key_func=get_remote_address)

# Verified-partner shops surface within this radius of the searched location.
NEARBY_RADIUS_KM = 15.0
MAX_NEARBY_SHOPS = 20


# ── Stateless shopkeeper tokens ────────────────────────────────────────────
# Namespaced ("shop:<id>") so they can never be mistaken for user/admin tokens.

def _sign_shop(shop_id: str) -> str:
    payload = f"shop:{shop_id}"
    return hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


def generate_shop_token(shop_id: str) -> str:
    return f"shop:{shop_id}.{_sign_shop(shop_id)}"


def resolve_shop_token(token: str) -> str | None:
    if not token or not token.startswith("shop:") or "." not in token:
        return None
    body, _, signature = token.rpartition(".")
    shop_id = body[len("shop:"):]
    if not shop_id or not signature:
        return None
    if not hmac.compare_digest(signature, _sign_shop(shop_id)):
        return None
    return shop_id


def _shop_from_token(token: str, db: Session) -> Shopkeeper:
    shop_id = resolve_shop_token(token)
    if not shop_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    try:
        shop = db.query(Shopkeeper).filter(Shopkeeper.id == uuid.UUID(shop_id)).first()
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if not shop:
        raise HTTPException(status_code=404, detail="Shopkeeper account not found")
    return shop


# ── Request / response models ──────────────────────────────────────────────

class ShopkeeperRegisterRequest(BaseModel):
    # Account
    first_name: str
    last_name: str
    username: str
    email: str
    phone: str
    password: str
    # Shop details
    shop_name: str
    category: str | None = None
    shop_phone: str | None = None
    website: str | None = None
    address: str
    city: str | None = None
    country: str | None = None
    opening_hours: str | None = None
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    # Verification
    document_type: str | None = None
    document_number: str | None = None
    document_image: str | None = None


class ShopkeeperLoginRequest(BaseModel):
    email: str
    password: str


class ShopkeeperAuthResponse(BaseModel):
    token: str
    shopkeeper: dict


# ── Validation helpers ─────────────────────────────────────────────────────

def _clean_required(value: str | None, field: str, max_len: int) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field} is required")
    if len(cleaned) > max_len:
        raise HTTPException(status_code=400, detail=f"{field} is too long (max {max_len} characters)")
    return cleaned


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Routes ─────────────────────────────────────────────────────────────────

@router.post("/shopkeepers/register", response_model=ShopkeeperAuthResponse)
@limiter.limit(_limit)
def register_shopkeeper(request: Request, body: ShopkeeperRegisterRequest, db: Session = Depends(get_db)):
    first_name = _clean_required(body.first_name, "First name", 100)
    last_name = _clean_required(body.last_name, "Last name", 100)
    username = _clean_required(body.username, "Username", 60)
    email = validate_email_address(body.email)
    phone = _clean_required(body.phone, "Phone", 40)
    validate_password(body.password)

    shop_name = _clean_required(body.shop_name, "Shop name", 150)
    address = _clean_required(body.address, "Shop address", 1000)

    if db.query(Shopkeeper).filter(Shopkeeper.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered. Please sign in.")
    if db.query(Shopkeeper).filter(Shopkeeper.username == username).first():
        raise HTTPException(status_code=409, detail="Username already taken. Please choose another.")

    shop = Shopkeeper(
        id=uuid.uuid4(),
        first_name=first_name,
        last_name=last_name,
        username=username,
        email=email,
        phone=phone,
        password_hash=hash_password(body.password),
        shop_name=shop_name,
        category=(body.category or "").strip() or None,
        shop_phone=(body.shop_phone or "").strip() or None,
        website=(body.website or "").strip() or None,
        address=address,
        city=(body.city or "").strip() or None,
        country=(body.country or "").strip() or None,
        opening_hours=(body.opening_hours or "").strip() or None,
        description=(body.description or "").strip() or None,
        latitude=body.latitude,
        longitude=body.longitude,
        document_type=(body.document_type or "").strip() or None,
        document_number=(body.document_number or "").strip() or None,
        document_image=body.document_image or None,
        created_at=datetime.utcnow(),
    )
    db.add(shop)
    db.commit()
    db.refresh(shop)

    token = generate_shop_token(str(shop.id))
    logger.info(f"New shopkeeper application submitted: {shop.email} ({shop.shop_name})")
    return ShopkeeperAuthResponse(token=token, shopkeeper=shop.to_account_dict())


@router.post("/shopkeepers/login", response_model=ShopkeeperAuthResponse)
@limiter.limit(_limit)
def login_shopkeeper(request: Request, body: ShopkeeperLoginRequest, db: Session = Depends(get_db)):
    shop = db.query(Shopkeeper).filter(Shopkeeper.email == (body.email or "").lower().strip()).first()
    if not shop or not verify_password(body.password, shop.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not shop.is_active:
        raise HTTPException(status_code=403, detail="Your shop account has been deactivated. Please contact support.")
    token = generate_shop_token(str(shop.id))
    logger.info(f"Shopkeeper logged in: {shop.email}")
    return ShopkeeperAuthResponse(token=token, shopkeeper=shop.to_account_dict())


@router.get("/shopkeepers/me")
def get_shopkeeper_me(token: str, db: Session = Depends(get_db)):
    shop = _shop_from_token(token, db)
    return shop.to_account_dict()


@router.get("/shops/nearby")
def nearby_shops(lat: float | None = None, lng: float | None = None, db: Session = Depends(get_db)):
    """Public: approved verified-partner shops, nearest first when a location
    is supplied. The locator merges these ahead of OpenStreetMap results."""
    approved = (
        db.query(Shopkeeper)
        .filter(Shopkeeper.status == SHOPKEEPER_STATUS_APPROVED)
        .filter(Shopkeeper.is_active.is_(True))
        .all()
    )

    results = []
    for shop in approved:
        record = shop.to_public_dict()
        if lat is not None and lng is not None and shop.latitude is not None and shop.longitude is not None:
            record["distance_km"] = round(_haversine_km(lat, lng, shop.latitude, shop.longitude), 3)
        else:
            record["distance_km"] = None
        results.append(record)

    if lat is not None and lng is not None:
        in_range = [
            record for record in results
            if record["distance_km"] is not None and record["distance_km"] <= NEARBY_RADIUS_KM
        ]
        in_range.sort(key=lambda record: record["distance_km"])
        results = in_range

    return {"shops": results[:MAX_NEARBY_SHOPS]}

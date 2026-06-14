import logging
import uuid
import hashlib
import secrets
import re
import httpx
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.db.models import User
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)
router = APIRouter()

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleAuthRequest(BaseModel):
    credential: str

class ForgotPasswordRequest(BaseModel):
    email: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    token: str
    name: str

class ChangePasswordRequest(BaseModel):
    token: str
    current_password: str
    new_password: str

class DeleteAccountRequest(BaseModel):
    token: str
    password: str

class UserOut(BaseModel):
    id: str
    name: str
    email: str

class AuthResponse(BaseModel):
    token: str
    user: UserOut

# ── Validation ───────────────────────────────────────────────────────────────

# Placeholder / disposable domains that look syntactically valid but cannot
# receive real mail. Rejected deterministically (no DNS needed).
FAKE_EMAIL_DOMAINS = {
    "nomail.com", "example.com", "example.org", "example.net", "test.com",
    "mailinator.com", "tempmail.com", "temp-mail.org", "guerrillamail.com",
    "10minutemail.com", "fakeinbox.com", "trashmail.com", "yopmail.com",
    "getnada.com", "dispostable.com", "throwawaymail.com", "sharklasers.com",
    "maildrop.cc", "mailnesia.com", "discard.email", "fake.com", "nowhere.com",
}

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
# Letters (incl. accented), spaces, hyphens and apostrophes — no digits/symbols.
NAME_RE = re.compile(r"^[A-Za-z\u00C0-\u024F]+(?:[ '\-][A-Za-z\u00C0-\u024F]+)*$")


def validate_name(name: str) -> str:
    cleaned = (name or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Name is required")
    if any(char.isdigit() for char in cleaned):
        raise HTTPException(status_code=400, detail="Name cannot contain numeric characters")
    if not NAME_RE.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Name can only contain letters, spaces, hyphens and apostrophes",
        )
    if len(cleaned) > 50:
        raise HTTPException(status_code=400, detail="Name is too long (max 50 characters)")
    return cleaned


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"[a-z]", password):
        raise HTTPException(status_code=400, detail="Password must include a lowercase letter")
    if not re.search(r"[A-Z]", password):
        raise HTTPException(status_code=400, detail="Password must include an uppercase letter")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must include a number")
    if not re.search(r"[^A-Za-z0-9]", password):
        raise HTTPException(status_code=400, detail="Password must include a special character")


def validate_email_address(email: str) -> str:
    """Validate format, reject placeholder domains, and (outside tests) verify
    the domain can actually receive mail via a DNS/MX lookup."""
    cleaned = (email or "").strip().lower()
    if not EMAIL_RE.match(cleaned):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")

    domain = cleaned.rsplit("@", 1)[-1]
    if domain in FAKE_EMAIL_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail=f'"{domain}" is not a real email domain. Please use a valid email address.',
        )

    # Authoritative deliverability check (skipped during tests to stay offline-safe).
    if not os.getenv("TESTING"):
        try:
            from email_validator import validate_email as _validate, EmailNotValidError
            _validate(cleaned, check_deliverability=True)
        except EmailNotValidError:
            raise HTTPException(
                status_code=400,
                detail=f'"{domain}" doesn\'t appear to accept email. Please use a real email address.',
            )
        except Exception as exc:  # transient DNS/network failure — don't block signup
            logger.warning(f"Email deliverability check skipped for {cleaned}: {exc}")

    return cleaned


def hash_password(password: str) -> str:
    salt = "screenai_salt_2026"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


# ── Stateless tokens ───────────────────────────────────────────────────────
# Token = "<user_id>.<hmac_sig>". Because the signature is derived from the
# user id + SECRET_KEY, any process can verify it without shared memory — so
# sessions survive server restarts (the previous in-memory dict did not).

import hmac

def _sign(user_id: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), user_id.encode(), hashlib.sha256).hexdigest()

def generate_token(user_id: str) -> str:
    return f"{user_id}.{_sign(user_id)}"

def resolve_token(token: str) -> str | None:
    """Return the user id encoded in a valid token, else None."""
    if not token or "." not in token:
        return None
    user_id, _, signature = token.rpartition(".")
    if not user_id or not signature:
        return None
    if not hmac.compare_digest(signature, _sign(user_id)):
        return None
    return user_id

import os
_limit = "1000/minute" if os.getenv("TESTING") == "true" else "3/minute"

@router.post("/auth/signup", response_model=AuthResponse)
@limiter.limit(_limit)

def signup(request: Request, request_body: SignupRequest, db: Session = Depends(get_db)):
    validate_password(request_body.password)
    name = validate_name(request_body.name)
    email = validate_email_address(request_body.email)

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered. Please sign in.")
    user = User(
        id=uuid.uuid4(),
        name=name,
        email=email,
        password_hash=hash_password(request_body.password),
        created_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = generate_token(str(user.id))
    logger.info(f"New user registered: {user.email}")
    return AuthResponse(token=token, user=UserOut(id=str(user.id), name=user.name, email=user.email))


import os
_limit = "1000/minute" if os.getenv("TESTING") == "true" else "5/minute"

@router.post("/auth/login", response_model=AuthResponse)
@limiter.limit(_limit)
def login(request: Request, request_body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request_body.email.lower()).first()
    if not user or not verify_password(request_body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = generate_token(str(user.id))
    logger.info(f"User logged in: {user.email}")
    return AuthResponse(token=token, user=UserOut(id=str(user.id), name=user.name, email=user.email))

@router.post("/auth/logout")
def logout(token: str):
    # Tokens are stateless — logout is handled client-side by discarding the token.
    return {"message": "Logged out successfully"}

def _user_from_token(token: str, db: Session) -> User:
    user_id = resolve_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/auth/me")
def get_me(token: str, db: Session = Depends(get_db)):
    user = _user_from_token(token, db)
    return UserOut(id=str(user.id), name=user.name, email=user.email)


@router.patch("/auth/profile", response_model=UserOut)
def update_profile(request_body: UpdateProfileRequest, db: Session = Depends(get_db)):
    user = _user_from_token(request_body.token, db)
    user.name = validate_name(request_body.name)
    db.commit()
    db.refresh(user)
    logger.info(f"Profile updated for user: {user.email}")
    return UserOut(id=str(user.id), name=user.name, email=user.email)


@router.post("/auth/change-password")
def change_password(request_body: ChangePasswordRequest, db: Session = Depends(get_db)):
    user = _user_from_token(request_body.token, db)
    if not verify_password(request_body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    validate_password(request_body.new_password)
    if verify_password(request_body.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="New password must be different from the current one")
    user.password_hash = hash_password(request_body.new_password)
    db.commit()
    logger.info(f"Password changed for user: {user.email}")
    return {"message": "Password changed successfully"}


@router.post("/auth/delete-account")
def delete_account(request_body: DeleteAccountRequest, db: Session = Depends(get_db)):
    user = _user_from_token(request_body.token, db)
    if not verify_password(request_body.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    email = user.email
    db.delete(user)
    db.commit()
    logger.info(f"Account deleted: {email}")
    return {"message": "Account deleted"}

@router.post("/auth/google", response_model=AuthResponse)
async def google_auth(request_body: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://oauth2.googleapis.com/tokeninfo?id_token={request_body.credential}",
                timeout=10.0
            )
            if resp.status_code != 200:
                logger.error(f"Google tokeninfo returned status {resp.status_code}: {resp.text}")
                raise HTTPException(status_code=400, detail="Invalid Google token")
            google_user = resp.json()
    except httpx.RequestError as exc:
        logger.error(f"Network error verifying Google token: {exc}")
        raise HTTPException(status_code=503, detail="Could not connect to Google auth services")

    if settings.GOOGLE_CLIENT_ID:
        if google_user.get("aud") != settings.GOOGLE_CLIENT_ID:
            logger.error(f"Google client ID mismatch: expected {settings.GOOGLE_CLIENT_ID}, got {google_user.get('aud')}")
            raise HTTPException(status_code=400, detail="Google token client ID mismatch")

    email = google_user.get("email")
    name = google_user.get("name", "Google User")
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    # Lowercase email and check if user exists
    email_lower = email.lower().strip()
    user = db.query(User).filter(User.email == email_lower).first()
    if not user:
        # Create user with a secure random password since password_hash is not nullable
        random_password = secrets.token_hex(32)
        user = User(
            id=uuid.uuid4(),
            name=name,
            email=email_lower,
            password_hash=hash_password(random_password),
            created_at=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Created new user via Google Sign-In: {email_lower}")
    else:
        logger.info(f"User signed in via Google Sign-In: {email_lower}")

    token = generate_token(str(user.id))
    return AuthResponse(token=token, user=UserOut(id=str(user.id), name=user.name, email=user.email))

@router.post("/auth/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    validate_password(request.new_password)
    email_lower = validate_email_address(request.email)
    user = db.query(User).filter(User.email == email_lower).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email address not found")

    user.password_hash = hash_password(request.new_password)
    db.commit()
    logger.info(f"Password reset successfully for user: {email_lower}")
    return {"message": "Password reset successfully"}

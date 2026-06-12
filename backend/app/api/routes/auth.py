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

_tokens: dict[str, str] = {}

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

class UserOut(BaseModel):
    id: str
    name: str
    email: str

class AuthResponse(BaseModel):
    token: str
    user: UserOut

def hash_password(password: str) -> str:
    salt = "screenai_salt_2026"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def generate_token() -> str:
    return secrets.token_hex(32)

import os
_limit = "1000/minute" if os.getenv("TESTING") == "true" else "3/minute"

@router.post("/auth/signup", response_model=AuthResponse)
@limiter.limit(_limit)

def signup(request: Request, request_body: SignupRequest, db: Session = Depends(get_db)):
    if len(request_body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not request_body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if any(char.isdigit() for char in request_body.name):
        raise HTTPException(status_code=400, detail="Name cannot contain numeric characters")
    
    EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if not re.match(EMAIL_REGEX, request_body.email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if not request_body.email.lower().strip().endswith("@gmail.com"):
        raise HTTPException(status_code=400, detail="Only Gmail addresses (@gmail.com) are allowed to register")

    existing = db.query(User).filter(User.email == request_body.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered. Please sign in.")
    user = User(
        id=uuid.uuid4(),
        name=request_body.name.strip(),
        email=request_body.email.lower().strip(),
        password_hash=hash_password(request_body.password),
        created_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = generate_token()
    _tokens[token] = str(user.id)
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
    token = generate_token()
    _tokens[token] = str(user.id)
    logger.info(f"User logged in: {user.email}")
    return AuthResponse(token=token, user=UserOut(id=str(user.id), name=user.name, email=user.email))

@router.post("/auth/logout")
def logout(token: str):
    _tokens.pop(token, None)
    return {"message": "Logged out successfully"}

@router.get("/auth/me")
def get_me(token: str, db: Session = Depends(get_db)):
    user_id = _tokens.get(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(id=str(user.id), name=user.name, email=user.email)

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
    if not email.lower().strip().endswith("@gmail.com"):
        raise HTTPException(status_code=400, detail="Only Gmail addresses (@gmail.com) are allowed to register")

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

    token = generate_token()
    _tokens[token] = str(user.id)
    return AuthResponse(token=token, user=UserOut(id=str(user.id), name=user.name, email=user.email))

@router.post("/auth/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    email_lower = request.email.lower().strip()
    if not email_lower.endswith("@gmail.com"):
        raise HTTPException(status_code=400, detail="Only Gmail addresses (@gmail.com) are allowed")
    user = db.query(User).filter(User.email == email_lower).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email address not found")

    user.password_hash = hash_password(request.new_password)
    db.commit()
    logger.info(f"Password reset successfully for user: {email_lower}")
    return {"message": "Password reset successfully"}

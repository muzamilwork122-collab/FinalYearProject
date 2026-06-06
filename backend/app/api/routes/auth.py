import logging
import uuid
import hashlib
import secrets
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.db.models import User
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

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
@router.post("/auth/login", response_model=AuthResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email.lower()).first()
    if not user or not verify_password(request.password, user.password_hash):
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

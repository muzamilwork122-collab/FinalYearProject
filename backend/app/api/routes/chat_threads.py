"""Live chat between customers and shopkeepers.

Real-time delivery is poll-based (the frontend re-fetches on a short interval),
which keeps the existing FastAPI + Postgres stack simple — no WebSocket
infrastructure required for this volume. `read_by_*` flags power the unread
badges and the in-app/website notifications.

A single set of endpoints serves both parties: the caller's token (a user
token or a `shop:` token) determines their role and which threads they see.
"""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.auth import resolve_token
from app.api.routes.shopkeeper import resolve_shop_token
from app.db.database import get_db
from app.db.models import (
    MESSAGE_SENDER_SHOP,
    MESSAGE_SENDER_USER,
    SHOPKEEPER_STATUS_APPROVED,
    Conversation,
    Message,
    Shopkeeper,
    User,
)

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_MESSAGE_LENGTH = 2000


class StartThreadRequest(BaseModel):
    token: str
    shopkeeper_id: str


class SendMessageRequest(BaseModel):
    token: str
    content: str


# ── Party resolution ────────────────────────────────────────────────────────

def _resolve_party(token: str, db: Session):
    """Return ("user", User) or ("shop", Shopkeeper) for a valid token, else None."""
    if not token:
        return None
    if token.startswith("shop:"):
        shop_id = resolve_shop_token(token)
        if not shop_id:
            return None
        shop = db.query(Shopkeeper).filter(Shopkeeper.id == uuid.UUID(shop_id)).first()
        return ("shop", shop) if shop else None
    user_id = resolve_token(token)
    if not user_id:
        return None
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    return ("user", user) if user else None


def _require_party(token: str, db: Session):
    party = _resolve_party(token, db)
    if not party:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return party


def _peer_for(conversation: Conversation, role: str) -> dict:
    """Display info for the *other* side of the conversation."""
    if role == MESSAGE_SENDER_USER:
        shop = conversation.shopkeeper
        return {"peer_id": str(shop.id), "peer_name": shop.shop_name, "peer_type": "shop"}
    user = conversation.user
    return {"peer_id": str(user.id), "peer_name": user.name, "peer_type": "user"}


def _unread_count(conversation: Conversation, role: str) -> int:
    if role == MESSAGE_SENDER_USER:
        return sum(
            1 for message in conversation.messages
            if message.sender_type == MESSAGE_SENDER_SHOP and not message.read_by_user
        )
    return sum(
        1 for message in conversation.messages
        if message.sender_type == MESSAGE_SENDER_USER and not message.read_by_shop
    )


def _thread_summary(conversation: Conversation, role: str) -> dict:
    last = conversation.messages[-1] if conversation.messages else None
    return {
        "id":              str(conversation.id),
        **_peer_for(conversation, role),
        "last_message":    last.content if last else "",
        "last_sender":     last.sender_type if last else None,
        "last_message_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
        "unread":          _unread_count(conversation, role),
    }


def _load_thread(thread_id: str, role: str, party, db: Session) -> Conversation:
    try:
        target = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid thread ID")
    conversation = db.query(Conversation).filter(Conversation.id == target).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    is_participant = (
        (role == MESSAGE_SENDER_USER and conversation.user_id == party.id)
        or (role == MESSAGE_SENDER_SHOP and conversation.shopkeeper_id == party.id)
    )
    if not is_participant:
        raise HTTPException(status_code=403, detail="You are not part of this conversation")
    return conversation


def _mark_read(conversation: Conversation, role: str) -> None:
    """Mark the incoming messages (from the other party) as read for this role."""
    for message in conversation.messages:
        if role == MESSAGE_SENDER_USER and message.sender_type == MESSAGE_SENDER_SHOP:
            message.read_by_user = True
        elif role == MESSAGE_SENDER_SHOP and message.sender_type == MESSAGE_SENDER_USER:
            message.read_by_shop = True


# ── Routes ─────────────────────────────────────────────────────────────────

@router.post("/chat/threads/start")
def start_thread(body: StartThreadRequest, db: Session = Depends(get_db)):
    role, party = _require_party(body.token, db)
    if role != MESSAGE_SENDER_USER:
        raise HTTPException(status_code=403, detail="Only customers can start a chat with a shop")

    try:
        shop_uuid = uuid.UUID(body.shopkeeper_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid shop ID")

    shop = db.query(Shopkeeper).filter(Shopkeeper.id == shop_uuid).first()
    if not shop or shop.status != SHOPKEEPER_STATUS_APPROVED:
        raise HTTPException(status_code=404, detail="Shop not found or not yet approved")

    conversation = (
        db.query(Conversation)
        .filter(Conversation.user_id == party.id, Conversation.shopkeeper_id == shop.id)
        .first()
    )
    if not conversation:
        conversation = Conversation(
            id=uuid.uuid4(),
            user_id=party.id,
            shopkeeper_id=shop.id,
            created_at=datetime.utcnow(),
            last_message_at=datetime.utcnow(),
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        logger.info(f"Chat thread opened: user {party.id} ↔ shop {shop.shop_name}")

    return _thread_summary(conversation, role)


@router.get("/chat/threads")
def list_threads(token: str, db: Session = Depends(get_db)):
    role, party = _require_party(token, db)
    if role == MESSAGE_SENDER_USER:
        column = Conversation.user_id
    else:
        column = Conversation.shopkeeper_id
    conversations = (
        db.query(Conversation)
        .filter(column == party.id)
        .order_by(Conversation.last_message_at.desc())
        .all()
    )
    return {"threads": [_thread_summary(conversation, role) for conversation in conversations]}


@router.get("/chat/threads/{thread_id}/messages")
def get_messages(thread_id: str, token: str, db: Session = Depends(get_db)):
    role, party = _require_party(token, db)
    conversation = _load_thread(thread_id, role, party, db)
    _mark_read(conversation, role)
    db.commit()
    return {
        "thread": _thread_summary(conversation, role),
        "messages": [message.to_dict(role) for message in conversation.messages],
    }


@router.post("/chat/threads/{thread_id}/messages")
def send_message(thread_id: str, body: SendMessageRequest, db: Session = Depends(get_db)):
    role, party = _require_party(body.token, db)
    conversation = _load_thread(thread_id, role, party, db)

    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(content) > MAX_MESSAGE_LENGTH:
        raise HTTPException(status_code=400, detail=f"Message is too long (max {MAX_MESSAGE_LENGTH} characters)")

    message = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        sender_type=role,
        content=content,
        created_at=datetime.utcnow(),
        read_by_user=(role == MESSAGE_SENDER_USER),
        read_by_shop=(role == MESSAGE_SENDER_SHOP),
    )
    db.add(message)
    conversation.last_message_at = message.created_at
    db.commit()
    db.refresh(message)
    return message.to_dict(role)


@router.get("/chat/unread")
def unread_count(token: str, db: Session = Depends(get_db)):
    role, party = _require_party(token, db)
    column = Conversation.user_id if role == MESSAGE_SENDER_USER else Conversation.shopkeeper_id
    conversations = db.query(Conversation).filter(column == party.id).all()
    total = sum(_unread_count(conversation, role) for conversation in conversations)
    return {"unread": total}

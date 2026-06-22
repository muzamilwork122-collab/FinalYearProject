import logging
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.core.config import settings
from app.db.database import get_db
from app.db.models import ChatHistory, User
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    token: Optional[str] = None   # user token for saving history
    context: Optional[str] = None  # optional summary of the user's own analyses
    ephemeral: Optional[bool] = False  # True for per-analysis chats: don't merge or save global history


class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessage]


SYSTEM_PROMPT = """You are an expert AI assistant specializing in smartphone screen damage assessment and repair in Pakistan.
Always give repair costs in Pakistani Rupees (PKR). Be concise, friendly, under 150 words.
Give specific PKR price ranges when asked about repair costs."""

REPAIR_TIPS = {
    "iphone":  "iPhone screen repairs in Pakistan: iPhone X LCD PKR 6,000–9,000, iPhone 11 PKR 8,000–12,000, iPhone 13 OLED PKR 18,000–25,000, iPhone 15 Pro PKR 35,000+.",
    "samsung": "Samsung repairs in Pakistan: A-series PKR 5,000–10,000, S-series PKR 15,000–30,000. Samsung-authorized centres offer original AMOLED panels.",
    "lcd":     "LCD replacement in Pakistan: PKR 3,500–15,000 depending on model. Ask for OEM or Grade A panels for best quality.",
    "oled":    "OLED/AMOLED replacement: PKR 12,000–40,000 in Pakistan. Worth it for flagship phones.",
    "crack":   "Hairline cracks worsen over time. Use tempered glass as a temp fix, get professional repair soon.",
    "cost":    "Repairs in Pakistan: budget phones PKR 3,000–8,000, mid-range PKR 8,000–18,000, flagships PKR 18,000–35,000+.",
    "pixel":   "Dead pixels are permanent. Single pixels may be unnoticeable but clusters need screen replacement.",
    "black":   "Black spots mean LCD/OLED panel damage beneath glass. Needs screen replacement — won't improve on its own.",
    "xiaomi":  "Xiaomi/Redmi repairs in Pakistan: PKR 4,000–12,000. Parts are widely available at Hafeez Center Lahore.",
    "oppo":    "OPPO screen repairs: PKR 5,000–15,000 in Pakistan. Visit authorized service centers for warranty repairs.",
}


def rule_based_response(user_message: str) -> str:
    msg_lower = user_message.lower()
    for keyword, response in REPAIR_TIPS.items():
        if keyword in msg_lower:
            return response
    return "I can help with screen damage questions! Ask me about repair costs in PKR, cracks, dead pixels, or upload a photo above for AI analysis."


async def llm_response(messages: List[ChatMessage], context: Optional[str] = None) -> str:
    key = settings.OPENAI_API_KEY
    if not key:
        last = next((m.content for m in reversed(messages) if m.role == "user"), "")
        return rule_based_response(last)
    try:
        from openai import OpenAI
        client = OpenAI(api_key=key)
        system_prompt = SYSTEM_PROMPT
        if context:
            system_prompt += (
                "\n\nThe user has run screen-damage analyses on this app. "
                "Use this summary of THEIR results to give personalised, specific advice. "
                "Refer to their actual numbers when relevant:\n" + context
            )
        openai_messages = [{"role": "system", "content": system_prompt}]
        for m in messages[-20:]:  # send last 20 messages for context
            if m.role in ("user", "assistant"):
                openai_messages.append({"role": m.role, "content": m.content})
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=openai_messages,
            max_tokens=200,
            temperature=0.7,
        )
        reply = response.choices[0].message.content.strip()
        logger.info(f"OpenAI reply: {reply[:80]}...")
        return reply
    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        last = next((m.content for m in reversed(messages) if m.role == "user"), "")
        return rule_based_response(last)


def save_messages_to_db(db: Session, user_id: str, user_msg: str, assistant_msg: str):
    """Save the user message and AI reply to chat_messages table."""
    try:
        uid = uuid.UUID(user_id)
        db.add(ChatHistory(user_id=uid, role="user",      content=user_msg,      created_at=datetime.utcnow()))
        db.add(ChatHistory(user_id=uid, role="assistant", content=assistant_msg, created_at=datetime.utcnow()))
        db.commit()
    except Exception as e:
        logger.error(f"Failed to save chat history: {e}")


def load_history_from_db(db: Session, user_id: str, limit: int = 50) -> List[ChatMessage]:
    """Load the last N messages for a user from the database."""
    try:
        uid = uuid.UUID(user_id)
        rows = (
            db.query(ChatHistory)
            .filter(ChatHistory.user_id == uid)
            .order_by(ChatHistory.created_at.asc())
            .limit(limit)
            .all()
        )
        return [ChatMessage(role=r.role, content=r.content) for r in rows]
    except Exception as e:
        logger.error(f"Failed to load chat history: {e}")
        return []


# ── Routes ─────────────────────────────────────────────────────────────────

@router.post("/chat")
@limiter.limit("20/minute")
async def chat(request: Request, request_body: ChatRequest, db: Session = Depends(get_db)):
    """
    Send a message and get AI response.
    If token is provided, saves history to DB and user gets persistent chat.
    """
    if not request_body.messages:
        return {"content": "Hello! How can I help you with screen damage today?"}

    logger.info(f"Chat | messages={len(request_body.messages)} | last='{request_body.messages[-1].content[:60]}'")

    # Get user_id from token if provided
    user_id = None
    if request_body.token:
        try:
            from app.api.routes.auth import resolve_token
            user_id = resolve_token(request_body.token)
        except Exception:
            pass

    # Per-analysis (ephemeral) chats are grounded only on the messages the
    # frontend sends + the analysis context. Merging the global DB history here
    # would leak a previous analysis session (e.g. a different phone model) into
    # the conversation, so we skip it. The persistent dashboard chat still merges
    # and saves history for continuity.
    if user_id and not request_body.ephemeral:
        db_history = load_history_from_db(db, user_id, limit=50)
        # Use DB history as base — more reliable than frontend state
        all_messages = db_history + [request_body.messages[-1]]  # add only the latest user message
    else:
        all_messages = request_body.messages

    reply = await llm_response(all_messages, context=request_body.context)

    # Save to DB only for the persistent chat (not per-analysis sessions)
    if user_id and not request_body.ephemeral:
        last_user_msg = next((m.content for m in reversed(request_body.messages) if m.role == "user"), "")
        save_messages_to_db(db, user_id, last_user_msg, reply)

    return {"content": reply}


@router.get("/chat/history")
def get_chat_history(token: str, db: Session = Depends(get_db)):
    """
    Load full chat history for the logged-in user.
    Called when the chat widget opens.
    """
    try:
        from app.api.routes.auth import resolve_token
        user_id = resolve_token(token)
        if not user_id:
            return {"messages": []}
        messages = load_history_from_db(db, user_id, limit=100)
        return {"messages": [{"role": m.role, "content": m.content} for m in messages]}
    except Exception as e:
        logger.error(f"History load error: {e}")
        return {"messages": []}


@router.delete("/chat/history")
def clear_chat_history(token: str, db: Session = Depends(get_db)):
    """Clear all chat history for the logged-in user."""
    try:
        from app.api.routes.auth import resolve_token
        user_id = resolve_token(token)
        if not user_id:
            return {"message": "Not authenticated"}
        uid = uuid.UUID(user_id)
        db.query(ChatHistory).filter(ChatHistory.user_id == uid).delete()
        db.commit()
        return {"message": "Chat history cleared"}
    except Exception as e:
        logger.error(f"History clear error: {e}")
        return {"message": "Failed to clear history"}

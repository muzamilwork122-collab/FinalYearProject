import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, String, Float, Integer, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name          = Column(String(100), nullable=False)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    # Business status, not deletion: an admin can suspend an account, which
    # blocks sign-in while keeping the record visible in the admin panel.
    is_active     = Column(Boolean, default=True, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)

    analyses      = relationship("Analysis", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")


class Analysis(Base):
    __tablename__ = "analyses"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at        = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_id           = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    phone_model       = Column(String(100), nullable=True)
    original_filename = Column(String(255), nullable=True)
    severity          = Column(String(10), nullable=False)
    damage_score      = Column(Float, nullable=False)
    confidence        = Column(Float, nullable=False)
    repair_cost_usd   = Column(Float, nullable=True)
    image_path        = Column(Text, nullable=True)
    mask_path         = Column(Text, nullable=True)

    user       = relationship("User", back_populates="analyses")
    detections = relationship("DetectionRecord", back_populates="analysis", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":              str(self.id),
            "created_at":      self.created_at.isoformat(),
            "phone_model":     self.phone_model,
            "severity":        self.severity,
            "damage_score":    self.damage_score,
            "confidence":      self.confidence,
            "repair_cost_usd": self.repair_cost_usd,
        }


class DetectionRecord(Base):
    __tablename__ = "detections"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    label       = Column(String(50), nullable=False)
    confidence  = Column(Float, nullable=False)
    bbox_x      = Column(Float, nullable=True)
    bbox_y      = Column(Float, nullable=True)
    bbox_w      = Column(Float, nullable=True)
    bbox_h      = Column(Float, nullable=True)

    analysis = relationship("Analysis", back_populates="detections")


class ChatHistory(Base):
    """Stores per-user chat messages so history persists across sessions."""
    __tablename__ = "chat_messages"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role       = Column(String(10), nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="chat_messages")


# Application lifecycle states for a shopkeeper. A new application starts as
# PENDING; an admin moves it to APPROVED or REJECTED. Terminal states are final.
SHOPKEEPER_STATUS_PENDING  = "pending"
SHOPKEEPER_STATUS_APPROVED = "approved"
SHOPKEEPER_STATUS_REJECTED = "rejected"


class Shopkeeper(Base):
    """A repair-shop owner who registers to be listed (with priority) on the
    maps/shops feature. Combines the account, the shop profile, and the
    verification documents submitted in the multi-step registration flow.

    Approved shops surface ahead of OpenStreetMap results in the locator.
    """
    __tablename__ = "shopkeepers"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Account (registration step 1) ─────────────────────────────
    first_name    = Column(String(100), nullable=False)
    last_name     = Column(String(100), nullable=False)
    username      = Column(String(60), unique=True, nullable=False, index=True)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    phone         = Column(String(40), nullable=False)
    password_hash = Column(Text, nullable=False)

    # ── Shop details (registration step 2) ────────────────────────
    shop_name     = Column(String(150), nullable=False)
    category      = Column(String(80), nullable=True)
    shop_phone    = Column(String(40), nullable=True)
    website       = Column(String(255), nullable=True)
    address       = Column(Text, nullable=False)
    city          = Column(String(120), nullable=True)
    country       = Column(String(120), nullable=True)
    opening_hours = Column(String(120), nullable=True)
    description   = Column(Text, nullable=True)
    latitude      = Column(Float, nullable=True)
    longitude     = Column(Float, nullable=True)

    # ── Verification documents (registration step 3) ──────────────
    # Stored inline as base64 data URLs (small files, no object storage).
    document_type   = Column(String(80), nullable=True)
    document_number = Column(String(120), nullable=True)
    document_image  = Column(Text, nullable=True)

    # ── Review lifecycle ──────────────────────────────────────────
    status           = Column(String(20), default=SHOPKEEPER_STATUS_PENDING, nullable=False, index=True)
    rejection_reason = Column(Text, nullable=True)
    # Suspend an approved shop without rejecting it: inactive shops drop off the
    # public map but remain in the admin panel for review/reactivation.
    is_active        = Column(Boolean, default=True, nullable=False)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at      = Column(DateTime, nullable=True)

    def to_public_dict(self):
        """Fields safe to expose on the public maps/shops feature."""
        return {
            "id":            str(self.id),
            "name":          self.shop_name,
            "category":      self.category,
            "address":       self.address,
            "city":          self.city,
            "country":       self.country,
            "phone":         self.shop_phone or self.phone,
            "website":       self.website,
            "opening":       self.opening_hours,
            "description":   self.description,
            "lat":           self.latitude,
            "lng":           self.longitude,
            "verified":      True,
        }

    def to_admin_dict(self):
        """Full application detail for the admin review panel."""
        return {
            "id":              str(self.id),
            "first_name":      self.first_name,
            "last_name":       self.last_name,
            "username":        self.username,
            "email":           self.email,
            "phone":           self.phone,
            "shop_name":       self.shop_name,
            "category":        self.category,
            "shop_phone":      self.shop_phone,
            "website":         self.website,
            "address":         self.address,
            "city":            self.city,
            "country":         self.country,
            "opening_hours":   self.opening_hours,
            "description":     self.description,
            "latitude":        self.latitude,
            "longitude":       self.longitude,
            "document_type":   self.document_type,
            "document_number": self.document_number,
            "document_image":  self.document_image,
            "status":          self.status,
            "is_active":       self.is_active,
            "rejection_reason": self.rejection_reason,
            "created_at":      self.created_at.isoformat() if self.created_at else None,
            "reviewed_at":     self.reviewed_at.isoformat() if self.reviewed_at else None,
        }

    def to_account_dict(self):
        """Status view returned to the shopkeeper themselves."""
        return {
            "id":               str(self.id),
            "first_name":       self.first_name,
            "last_name":        self.last_name,
            "username":         self.username,
            "email":            self.email,
            "phone":            self.phone,
            "shop_name":        self.shop_name,
            "category":         self.category,
            "shop_phone":       self.shop_phone,
            "website":          self.website,
            "address":          self.address,
            "city":             self.city,
            "country":          self.country,
            "opening_hours":    self.opening_hours,
            "description":      self.description,
            "latitude":         self.latitude,
            "longitude":        self.longitude,
            "status":           self.status,
            "is_active":        self.is_active,
            "rejection_reason": self.rejection_reason,
            "created_at":       self.created_at.isoformat() if self.created_at else None,
            "reviewed_at":      self.reviewed_at.isoformat() if self.reviewed_at else None,
        }


# Who sent a chat message — a customer ("user") or a shopkeeper ("shop").
MESSAGE_SENDER_USER = "user"
MESSAGE_SENDER_SHOP = "shop"


class Conversation(Base):
    """A 1:1 chat thread between a customer and a shopkeeper. One thread per
    (user, shopkeeper) pair — re-opening a chat reuses the same thread."""
    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("user_id", "shopkeeper_id", name="uq_conversation_pair"),)

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id         = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    shopkeeper_id   = Column(UUID(as_uuid=True), ForeignKey("shopkeepers.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_message_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    user       = relationship("User")
    shopkeeper = relationship("Shopkeeper")
    messages   = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class Message(Base):
    """A single chat message within a conversation. `read_by_*` flags drive the
    unread badges + the website notification system for the opposite party."""
    __tablename__ = "messages"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_type     = Column(String(10), nullable=False)
    content         = Column(Text, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    read_by_user    = Column(Boolean, default=False, nullable=False)
    read_by_shop    = Column(Boolean, default=False, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")

    def to_dict(self, viewer_role: str):
        return {
            "id":         str(self.id),
            "sender":     self.sender_type,
            "mine":       self.sender_type == viewer_role,
            "content":    self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AdminAccount(Base):
    """The single platform administrator. Seeded once from config defaults
    (ADMIN_EMAIL / ADMIN_PASSWORD), then editable from the admin panel — so the
    admin can change their own profile and password without a redeploy."""
    __tablename__ = "admin_accounts"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    name          = Column(String(100), default="Administrator", nullable=False)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    # Optional profile picture, stored inline as a base64 data URL (small image).
    avatar        = Column(Text, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {"name": self.name, "email": self.email, "avatar": self.avatar}

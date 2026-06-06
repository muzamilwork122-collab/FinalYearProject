import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name          = Column(String(100), nullable=False)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
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

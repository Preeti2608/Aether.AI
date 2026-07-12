"""
Aether AI - Notes Models
"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.core.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False, default="")
    summary = Column(Text, nullable=True)
    tags = Column(String(500), default="")
    collection_id = Column(String, ForeignKey("collections.id"), nullable=True)
    is_pinned = Column(Boolean, default=False)
    color = Column(String(20), default="default")
    word_count = Column(String(10), default="0")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

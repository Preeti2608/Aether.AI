"""
Aether AI - Memory Models
SQLAlchemy ORM models for long-term memory storage
"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from datetime import datetime, timezone
import uuid
from app.core.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Memory(Base):
    __tablename__ = "memories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    content = Column(Text, nullable=False)
    category = Column(String(50), default="general")  # fact | preference | project | learning | personal
    collection_id = Column(String, ForeignKey("collections.id"), nullable=True)
    tags = Column(String(500), default="")  # comma-separated
    is_pinned = Column(Boolean, default=False)
    source = Column(String(100), default="manual")  # manual | chat | import
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

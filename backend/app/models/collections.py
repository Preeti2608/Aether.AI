"""
Aether AI - Collections Models
"""
from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime, timezone
import uuid
from app.core.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Collection(Base):
    __tablename__ = "collections"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    icon = Column(String(50), default="folder")
    color = Column(String(20), default="blue")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

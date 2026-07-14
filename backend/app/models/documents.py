"""
Aether AI - Document Models (PDF)
"""
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean
from datetime import datetime, timezone
import uuid
from app.core.database import Base


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)
    page_count = Column(Integer, default=0)
    status = Column(String(20), default="processing")  # processing | ready | error
    chunk_count = Column(Integer, default=0)
    summary = Column(Text, nullable=True)
    collection_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

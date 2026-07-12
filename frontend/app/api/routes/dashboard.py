"""
Aether AI - Dashboard & Settings API
App stats, model management, and data export/import
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json

from app.core.database import get_db
from app.core.ollama_client import ollama_client
from app.core.config import get_settings
from app.models.chat import ChatSession, ChatMessage
from app.models.memory import Memory
from app.models.notes import Note
from app.models.documents import Document
from app.models.collections import Collection
from app.core.vector_store import get_chroma_client

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])
settings = get_settings()


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Get dashboard statistics."""
    chat_count = await db.scalar(select(func.count(ChatSession.id))) or 0
    memory_count = await db.scalar(select(func.count(Memory.id))) or 0
    note_count = await db.scalar(select(func.count(Note.id))) or 0
    doc_count = await db.scalar(select(func.count(Document.id)).where(Document.status == "ready")) or 0
    collection_count = await db.scalar(select(func.count(Collection.id))) or 0

    # Recent activity
    recent_chats = await db.execute(
        select(ChatSession).order_by(ChatSession.updated_at.desc()).limit(5)
    )
    recent_notes = await db.execute(
        select(Note).order_by(Note.updated_at.desc()).limit(3)
    )
    recent_mems = await db.execute(
        select(Memory).order_by(Memory.created_at.desc()).limit(3)
    )

    activity = []
    for s in recent_chats.scalars():
        activity.append({"type": "chat", "title": s.title, "time": s.updated_at.isoformat()})
    for n in recent_notes.scalars():
        activity.append({"type": "note", "title": n.title, "time": n.updated_at.isoformat()})
    for m in recent_mems.scalars():
        activity.append({"type": "memory", "title": m.content[:60], "time": m.created_at.isoformat()})

    activity.sort(key=lambda x: x["time"], reverse=True)

    # AI model status
    is_online = await ollama_client.health_check()
    models = await ollama_client.list_models() if is_online else []

    return {
        "stats": {
            "chats": chat_count,
            "memories": memory_count,
            "notes": note_count,
            "documents": doc_count,
            "collections": collection_count,
        },
        "ai": {
            "online": is_online,
            "models": [m.get("name", "") for m in models],
            "current_model": settings.default_model,
        },
        "recent_activity": activity[:10],
    }


# ── Settings router ────────────────────────────────────────────────────────────
settings_router = APIRouter(prefix="/settings", tags=["Settings"])


class AppSettings(BaseModel):
    default_model: Optional[str] = None
    ollama_base_url: Optional[str] = None


@settings_router.get("/")
async def get_settings_endpoint():
    """Get current application settings."""
    s = get_settings()
    is_online = await ollama_client.health_check()
    models = await ollama_client.list_models() if is_online else []
    return {
        "default_model": s.default_model,
        "ollama_base_url": s.ollama_base_url,
        "ai_online": is_online,
        "available_models": [m.get("name", "") for m in models],
        "app_version": s.app_version,
    }


@settings_router.get("/models")
async def list_models():
    """List available Ollama models."""
    is_online = await ollama_client.health_check()
    if not is_online:
        return {"online": False, "models": []}
    models = await ollama_client.list_models()
    return {"online": True, "models": models}


@settings_router.post("/export")
async def export_data(db: AsyncSession = Depends(get_db)):
    """Export all user data as JSON."""
    memories = (await db.execute(select(Memory))).scalars().all()
    notes = (await db.execute(select(Note))).scalars().all()
    collections = (await db.execute(select(Collection))).scalars().all()

    return {
        "version": "1.0",
        "exported_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).replace(tzinfo=None).isoformat(),
        "memories": [{"id": m.id, "content": m.content, "category": m.category, "tags": m.tags} for m in memories],
        "notes": [{"id": n.id, "title": n.title, "content": n.content, "tags": n.tags} for n in notes],
        "collections": [{"id": c.id, "name": c.name, "description": c.description} for c in collections],
    }


@settings_router.post("/clear-memory")
async def clear_all_memory(db: AsyncSession = Depends(get_db)):
    """Clear all memories."""
    await db.execute(delete(Memory))
    await db.commit()
    try:
        client = get_chroma_client()
        client.delete_collection("aether_memories")
    except Exception:
        pass
    return {"message": "All memories cleared"}


@settings_router.post("/reset")
async def reset_application(db: AsyncSession = Depends(get_db)):
    """Reset the entire application (delete all data)."""
    await db.execute(delete(ChatMessage))
    await db.execute(delete(ChatSession))
    await db.execute(delete(Memory))
    await db.execute(delete(Note))
    await db.execute(delete(Document))
    await db.execute(delete(Collection))
    await db.commit()
    try:
        client = get_chroma_client()
        for col_name in ["aether_memories", "aether_notes", "aether_documents", "aether_chat_history"]:
            try:
                client.delete_collection(col_name)
            except Exception:
                pass
    except Exception:
        pass
    return {"message": "Application reset successfully"}

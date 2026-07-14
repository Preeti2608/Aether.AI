"""
Aether AI - Notes API Routes
Smart notes with AI-powered summarization and writing improvement
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.notes import Note
from app.core.vector_store import upsert_embeddings, semantic_search, delete_from_collection
from app.core.ollama_client import ollama_client
from app.core.config import get_settings
from loguru import logger

router = APIRouter(prefix="/notes", tags=["Notes"])
settings = get_settings()
NOTES_COLLECTION = "aether_notes"


class NoteCreate(BaseModel):
    title: str
    content: str = ""
    tags: Optional[str] = ""
    collection_id: Optional[str] = None
    color: str = "default"


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None
    collection_id: Optional[str] = None
    color: Optional[str] = None
    is_pinned: Optional[bool] = None


class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    summary: Optional[str]
    tags: str
    collection_id: Optional[str]
    is_pinned: bool
    color: str
    word_count: str
    created_at: datetime
    updated_at: datetime


class AIActionRequest(BaseModel):
    action: str  # summarize | improve | expand | fix_grammar
    model: Optional[str] = None


@router.get("/", response_model=List[NoteResponse])
async def list_notes(
    collection_id: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List all notes."""
    query = select(Note).order_by(Note.is_pinned.desc(), Note.updated_at.desc())
    if collection_id:
        query = query.where(Note.collection_id == collection_id)
    if tag:
        query = query.where(Note.tags.like(f"%{tag}%"))
    result = await db.execute(query.limit(limit))
    notes = result.scalars().all()
    return [_to_response(n) for n in notes]


@router.post("/", response_model=NoteResponse)
async def create_note(data: NoteCreate, db: AsyncSession = Depends(get_db)):
    """Create a new note."""
    word_count = str(len(data.content.split())) if data.content else "0"
    note = Note(
        title=data.title, content=data.content,
        tags=data.tags or "", collection_id=data.collection_id,
        color=data.color, word_count=word_count,
    )
    db.add(note)
    await db.flush()

    # Embed for semantic search
    if data.content:
        try:
            embed_text = f"{data.title}\n{data.content}"
            upsert_embeddings(NOTES_COLLECTION, ids=[note.id], texts=[embed_text],
                              metadatas=[{"title": data.title, "tags": data.tags or ""}])
        except Exception as e:
            logger.warning(f"Embed note failed: {e}")

    await db.commit()
    await db.refresh(note)
    return _to_response(note)


@router.get("/search", response_model=List[NoteResponse])
async def search_notes(q: str = Query(..., min_length=1), db: AsyncSession = Depends(get_db)):
    """Semantic search over notes."""
    results = semantic_search(NOTES_COLLECTION, q, n_results=10)
    ids = results.get("ids", [[]])[0]
    if not ids:
        return []
    db_result = await db.execute(select(Note).where(Note.id.in_(ids)))
    notes_map = {n.id: n for n in db_result.scalars().all()}
    return [_to_response(notes_map[nid]) for nid in ids if nid in notes_map]


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single note."""
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return _to_response(note)


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, data: NoteUpdate, db: AsyncSession = Depends(get_db)):
    """Update a note."""
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if data.title is not None:
        note.title = data.title
    if data.content is not None:
        note.content = data.content
        note.word_count = str(len(data.content.split()))
    if data.tags is not None:
        note.tags = data.tags
    if data.collection_id is not None:
        note.collection_id = data.collection_id
    if data.color is not None:
        note.color = data.color
    if data.is_pinned is not None:
        note.is_pinned = data.is_pinned

    note.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Re-embed
    try:
        embed_text = f"{note.title}\n{note.content}"
        upsert_embeddings(NOTES_COLLECTION, ids=[note_id], texts=[embed_text],
                          metadatas=[{"title": note.title, "tags": note.tags}])
    except Exception as e:
        logger.warning(f"Re-embed note failed: {e}")

    await db.commit()
    await db.refresh(note)
    return _to_response(note)


@router.delete("/{note_id}")
async def delete_note(note_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a note."""
    await db.execute(delete(Note).where(Note.id == note_id))
    await db.commit()
    try:
        delete_from_collection(NOTES_COLLECTION, [note_id])
    except Exception:
        pass
    return {"message": "Note deleted"}


@router.post("/{note_id}/ai")
async def ai_action_on_note(note_id: str, request: AIActionRequest, db: AsyncSession = Depends(get_db)):
    """Apply AI action to note: summarize | improve | expand | fix_grammar."""
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    model = request.model or settings.default_model
    prompts = {
        "summarize": f"Summarize the following note concisely in 2-3 sentences:\n\n{note.content}",
        "improve": f"Improve the writing quality, clarity, and structure of this note. Return only the improved version:\n\n{note.content}",
        "expand": f"Expand and elaborate on this note with more detail and examples:\n\n{note.content}",
        "fix_grammar": f"Fix grammar and spelling in this note. Return only the corrected version:\n\n{note.content}",
    }
    prompt = prompts.get(request.action)
    if not prompt:
        raise HTTPException(status_code=400, detail="Invalid action. Use: summarize, improve, expand, fix_grammar")

    try:
        ai_result = await ollama_client.generate(model=model, prompt=prompt)
        if request.action == "summarize":
            note.summary = ai_result
            await db.commit()
        return {"result": ai_result, "action": request.action}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


def _to_response(n: Note) -> NoteResponse:
    return NoteResponse(
        id=n.id, title=n.title, content=n.content,
        summary=n.summary, tags=n.tags or "", collection_id=n.collection_id,
        is_pinned=n.is_pinned, color=n.color, word_count=n.word_count or "0",
        created_at=n.created_at, updated_at=n.updated_at,
    )

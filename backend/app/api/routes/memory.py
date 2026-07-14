"""
Aether AI - Memory API Routes
Long-term memory storage with semantic search and categorization
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.models.memory import Memory
from app.core.vector_store import upsert_embeddings, semantic_search, delete_from_collection
from loguru import logger

router = APIRouter(prefix="/memories", tags=["Memory"])

MEMORY_COLLECTION = "aether_memories"


class MemoryCreate(BaseModel):
    content: str
    category: str = "general"
    collection_id: Optional[str] = None
    tags: Optional[str] = ""
    is_pinned: bool = False
    source: str = "manual"


class MemoryUpdate(BaseModel):
    content: Optional[str] = None
    category: Optional[str] = None
    collection_id: Optional[str] = None
    tags: Optional[str] = None
    is_pinned: Optional[bool] = None


class MemoryResponse(BaseModel):
    id: str
    content: str
    category: str
    collection_id: Optional[str]
    tags: str
    is_pinned: bool
    source: str
    created_at: datetime
    updated_at: datetime


@router.get("/", response_model=List[MemoryResponse])
async def list_memories(
    category: Optional[str] = None,
    collection_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List all memories with optional filtering."""
    query = select(Memory).order_by(Memory.is_pinned.desc(), Memory.created_at.desc())
    if category:
        query = query.where(Memory.category == category)
    if collection_id:
        query = query.where(Memory.collection_id == collection_id)
    result = await db.execute(query.limit(limit))
    memories = result.scalars().all()
    return [_to_response(m) for m in memories]


@router.post("/", response_model=MemoryResponse)
async def create_memory(data: MemoryCreate, db: AsyncSession = Depends(get_db)):
    """Create a new memory and embed it for semantic search."""
    memory = Memory(
        content=data.content,
        category=data.category,
        collection_id=data.collection_id,
        tags=data.tags or "",
        is_pinned=data.is_pinned,
        source=data.source,
    )
    db.add(memory)
    await db.flush()

    # Embed for semantic search
    try:
        upsert_embeddings(
            MEMORY_COLLECTION,
            ids=[memory.id],
            texts=[data.content],
            metadatas=[{
                "category": data.category,
                "collection_id": data.collection_id or "",
                "tags": data.tags or "",
                "source": data.source,
            }],
        )
    except Exception as e:
        logger.warning(f"Failed to embed memory {memory.id}: {e}")

    await db.commit()
    await db.refresh(memory)
    return _to_response(memory)


@router.get("/search", response_model=List[MemoryResponse])
async def search_memories(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Semantic search over memories."""
    results = semantic_search(MEMORY_COLLECTION, q, n_results=limit)
    ids = results.get("ids", [[]])[0]
    if not ids:
        return []

    db_result = await db.execute(select(Memory).where(Memory.id.in_(ids)))
    memories_map = {m.id: m for m in db_result.scalars().all()}
    # Return in relevance order
    return [_to_response(memories_map[mid]) for mid in ids if mid in memories_map]


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory(memory_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single memory by ID."""
    result = await db.execute(select(Memory).where(Memory.id == memory_id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return _to_response(memory)


@router.patch("/{memory_id}", response_model=MemoryResponse)
async def update_memory(memory_id: str, data: MemoryUpdate, db: AsyncSession = Depends(get_db)):
    """Update a memory."""
    result = await db.execute(select(Memory).where(Memory.id == memory_id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    if data.content is not None:
        memory.content = data.content
        # Re-embed
        try:
            upsert_embeddings(MEMORY_COLLECTION, ids=[memory_id], texts=[data.content],
                              metadatas=[{"category": memory.category, "tags": memory.tags}])
        except Exception as e:
            logger.warning(f"Re-embed failed: {e}")
    if data.category is not None:
        memory.category = data.category
    if data.collection_id is not None:
        memory.collection_id = data.collection_id
    if data.tags is not None:
        memory.tags = data.tags
    if data.is_pinned is not None:
        memory.is_pinned = data.is_pinned

    memory.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(memory)
    return _to_response(memory)


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a memory."""
    await db.execute(delete(Memory).where(Memory.id == memory_id))
    await db.commit()
    try:
        delete_from_collection(MEMORY_COLLECTION, [memory_id])
    except Exception:
        pass
    return {"message": "Memory deleted"}


@router.get("/stats/summary")
async def memory_stats(db: AsyncSession = Depends(get_db)):
    """Get memory statistics."""
    result = await db.execute(select(Memory))
    memories = result.scalars().all()
    categories = {}
    for m in memories:
        categories[m.category] = categories.get(m.category, 0) + 1
    return {
        "total": len(memories),
        "pinned": sum(1 for m in memories if m.is_pinned),
        "by_category": categories,
    }


def _to_response(m: Memory) -> MemoryResponse:
    return MemoryResponse(
        id=m.id, content=m.content, category=m.category,
        collection_id=m.collection_id, tags=m.tags or "",
        is_pinned=m.is_pinned, source=m.source,
        created_at=m.created_at, updated_at=m.updated_at,
    )

"""
Aether AI - Collections API
Organize memories and notes into named collections
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.collections import Collection
from app.models.memory import Memory
from app.models.notes import Note

router = APIRouter(prefix="/collections", tags=["Collections"])

DEFAULT_COLLECTIONS = [
    {"name": "Study", "icon": "book-open", "color": "blue"},
    {"name": "Projects", "icon": "folder", "color": "purple"},
    {"name": "Personal", "icon": "heart", "color": "rose"},
    {"name": "Work", "icon": "briefcase", "color": "amber"},
]


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    icon: str = "folder"
    color: str = "blue"


class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CollectionResponse(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    color: str
    memory_count: int
    note_count: int
    created_at: datetime


@router.get("/", response_model=List[CollectionResponse])
async def list_collections(db: AsyncSession = Depends(get_db)):
    """List all collections with item counts."""
    result = await db.execute(select(Collection).order_by(Collection.created_at))
    collections = result.scalars().all()

    output = []
    for col in collections:
        mem_count = await db.scalar(
            select(func.count(Memory.id)).where(Memory.collection_id == col.id)
        ) or 0
        note_count = await db.scalar(
            select(func.count(Note.id)).where(Note.collection_id == col.id)
        ) or 0
        output.append(CollectionResponse(
            id=col.id, name=col.name, description=col.description or "",
            icon=col.icon, color=col.color,
            memory_count=mem_count, note_count=note_count,
            created_at=col.created_at,
        ))
    return output


@router.post("/", response_model=CollectionResponse)
async def create_collection(data: CollectionCreate, db: AsyncSession = Depends(get_db)):
    """Create a new collection."""
    collection = Collection(
        name=data.name, description=data.description or "",
        icon=data.icon, color=data.color,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)
    return CollectionResponse(
        id=collection.id, name=collection.name,
        description=collection.description or "", icon=collection.icon,
        color=collection.color, memory_count=0, note_count=0,
        created_at=collection.created_at,
    )


@router.patch("/{collection_id}", response_model=CollectionResponse)
async def update_collection(collection_id: str, data: CollectionUpdate, db: AsyncSession = Depends(get_db)):
    """Update a collection."""
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    col = result.scalar_one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    if data.name is not None:
        col.name = data.name
    if data.description is not None:
        col.description = data.description
    if data.icon is not None:
        col.icon = data.icon
    if data.color is not None:
        col.color = data.color
    col.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(col)
    mem_count = await db.scalar(select(func.count(Memory.id)).where(Memory.collection_id == collection_id)) or 0
    note_count = await db.scalar(select(func.count(Note.id)).where(Note.collection_id == collection_id)) or 0
    return CollectionResponse(
        id=col.id, name=col.name, description=col.description or "",
        icon=col.icon, color=col.color, memory_count=mem_count,
        note_count=note_count, created_at=col.created_at,
    )


@router.delete("/{collection_id}")
async def delete_collection(collection_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a collection (items are not deleted, just unlinked)."""
    await db.execute(delete(Collection).where(Collection.id == collection_id))
    await db.commit()
    return {"message": "Collection deleted"}


@router.post("/seed")
async def seed_default_collections(db: AsyncSession = Depends(get_db)):
    """Seed default collections if none exist."""
    result = await db.execute(select(Collection))
    if result.scalars().first():
        return {"message": "Collections already exist"}
    for col_data in DEFAULT_COLLECTIONS:
        db.add(Collection(**col_data))
    await db.commit()
    return {"message": "Default collections created"}

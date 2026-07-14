"""
Aether AI - Search API
Unified semantic search across memories, notes, and documents
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends

from app.core.database import get_db
from app.core.vector_store import semantic_search
from app.models.memory import Memory
from app.models.notes import Note
from app.models.documents import Document

router = APIRouter(prefix="/search", tags=["Search"])


class SearchResult(BaseModel):
    id: str
    type: str  # memory | note | document
    title: str
    excerpt: str
    score: float
    metadata: dict


@router.get("/", response_model=List[SearchResult])
async def unified_search(
    q: str = Query(..., min_length=1, description="Search query"),
    types: Optional[str] = Query("all", description="Comma-separated: memory,note,document"),
    limit: int = Query(10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Semantic search across all content types."""
    search_types = [t.strip() for t in types.split(",")] if types != "all" else ["memory", "note", "document"]
    results = []

    if "memory" in search_types:
        mem_results = semantic_search("aether_memories", q, n_results=min(limit, 5))
        ids = mem_results.get("ids", [[]])[0]
        distances = mem_results.get("distances", [[]])[0]
        docs = mem_results.get("documents", [[]])[0]
        for mid, dist, doc in zip(ids, distances, docs):
            results.append(SearchResult(
                id=mid, type="memory", title="Memory",
                excerpt=doc[:200], score=round(1 - dist, 3), metadata={"category": "memory"}
            ))

    if "note" in search_types:
        note_results = semantic_search("aether_notes", q, n_results=min(limit, 5))
        ids = note_results.get("ids", [[]])[0]
        distances = note_results.get("distances", [[]])[0]
        docs = note_results.get("documents", [[]])[0]

        if ids:
            db_result = await db.execute(select(Note).where(Note.id.in_(ids)))
            notes_map = {n.id: n for n in db_result.scalars().all()}
            for nid, dist, doc in zip(ids, distances, docs):
                note = notes_map.get(nid)
                results.append(SearchResult(
                    id=nid, type="note",
                    title=note.title if note else "Note",
                    excerpt=doc[:200], score=round(1 - dist, 3),
                    metadata={"tags": note.tags if note else ""}
                ))

    if "document" in search_types:
        doc_results = semantic_search("aether_documents", q, n_results=min(limit, 5))
        ids = doc_results.get("ids", [[]])[0]
        distances = doc_results.get("distances", [[]])[0]
        docs_text = doc_results.get("documents", [[]])[0]
        metadatas = doc_results.get("metadatas", [[]])[0]

        for did, dist, doc_text, meta in zip(ids, distances, docs_text, metadatas):
            results.append(SearchResult(
                id=meta.get("document_id", did), type="document",
                title=meta.get("filename", "Document"),
                excerpt=doc_text[:200], score=round(1 - dist, 3),
                metadata={"chunk_id": did, "filename": meta.get("filename", "")}
            ))

    # Sort by score descending
    results.sort(key=lambda x: x.score, reverse=True)
    return results[:limit]

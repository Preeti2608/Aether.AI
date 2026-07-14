"""
Aether AI - PDF Document API Routes
Upload PDFs, chunk and embed content, chat with documents using RAG
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import uuid
import shutil

from app.core.database import get_db
from app.models.documents import Document
from app.core.vector_store import upsert_embeddings, semantic_search, delete_from_collection
from app.core.ollama_client import ollama_client
from app.core.config import get_settings
from loguru import logger

router = APIRouter(prefix="/documents", tags=["Documents"])
settings = get_settings()
DOCS_COLLECTION = "aether_documents"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_name: str
    file_size: int
    page_count: int
    status: str
    chunk_count: int
    summary: Optional[str]
    collection_id: Optional[str]
    created_at: datetime


class ChatWithDocRequest(BaseModel):
    question: str
    model: Optional[str] = None
    top_k: int = 5


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping chunks."""
    if not text.strip():
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
        if start >= len(text):
            break
    return chunks


async def extract_pdf_text(file_path: str) -> tuple[str, int]:
    """Extract text and page count from PDF."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n\n".join(pages), len(reader.pages)
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        return "", 0


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(db: AsyncSession = Depends(get_db)):
    """List all uploaded documents."""
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    docs = result.scalars().all()
    return [_to_response(d) for d in docs]


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    collection_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload and process a PDF document."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_size = 0
    os.makedirs(settings.upload_dir, exist_ok=True)
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}.pdf"
    file_path = os.path.join(settings.upload_dir, safe_filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        file_size = len(content)
        if file_size > settings.max_upload_size_mb * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large")
        f.write(content)

    # Create DB record
    doc = Document(
        id=file_id,
        filename=safe_filename,
        original_name=file.filename,
        file_path=file_path,
        file_size=file_size,
        status="processing",
        collection_id=collection_id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Process in background (simplified sync for hackathon)
    try:
        text, page_count = await extract_pdf_text(file_path)
        chunks = chunk_text(text)
        if chunks:
            chunk_ids = [f"{file_id}_chunk_{i}" for i in range(len(chunks))]
            metadatas = [{"document_id": file_id, "chunk_index": i, "filename": file.filename} for i in range(len(chunks))]
            upsert_embeddings(DOCS_COLLECTION, ids=chunk_ids, texts=chunks, metadatas=metadatas)

        doc.page_count = page_count
        doc.chunk_count = len(chunks)
        doc.status = "ready"
        await db.commit()
        await db.refresh(doc)
    except Exception as e:
        logger.error(f"Document processing failed: {e}")
        doc.status = "error"
        await db.commit()
        await db.refresh(doc)

    return _to_response(doc)


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    """Get document details."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _to_response(doc)


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a document and its embeddings."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    # Delete embeddings
    try:
        delete_from_collection(DOCS_COLLECTION, 
                               [f"{doc_id}_chunk_{i}" for i in range(doc.chunk_count)])
    except Exception:
        pass

    await db.execute(delete(Document).where(Document.id == doc_id))
    await db.commit()
    return {"message": "Document deleted"}


@router.post("/{doc_id}/chat")
async def chat_with_document(
    doc_id: str,
    request: ChatWithDocRequest,
    db: AsyncSession = Depends(get_db),
):
    """Ask a question about a specific document using RAG."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != "ready":
        raise HTTPException(status_code=400, detail="Document not ready for querying")

    # Semantic search for relevant chunks
    search_results = semantic_search(
        DOCS_COLLECTION, request.question, n_results=request.top_k,
        where={"document_id": doc_id}
    )
    chunks = search_results.get("documents", [[]])[0]
    distances = search_results.get("distances", [[]])[0]

    if not chunks:
        raise HTTPException(status_code=404, detail="No relevant content found")

    context = "\n\n---\n\n".join(chunks)
    model = request.model or settings.default_model

    prompt = f"""You are answering questions about the document: "{doc.original_name}".
    
Use only the following excerpts to answer the question. If the answer is not in the excerpts, say so.
Always cite which part of the document your answer comes from.

Document excerpts:
{context}

Question: {request.question}

Answer:"""

    try:
        answer = await ollama_client.generate(model=model, prompt=prompt)
        return {
            "answer": answer,
            "document": doc.original_name,
            "sources": [{"chunk": c, "relevance": round(1 - d, 3)} for c, d in zip(chunks[:3], distances[:3])],
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/{doc_id}/summarize")
async def summarize_document(doc_id: str, model: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Generate or retrieve a document summary."""
    result = await db.execute(select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.summary:
        return {"summary": doc.summary, "cached": True}

    # Get first few chunks for summarization
    search_results = semantic_search(DOCS_COLLECTION, "main topic overview summary", n_results=8,
                                     where={"document_id": doc_id})
    chunks = search_results.get("documents", [[]])[0]
    if not chunks:
        raise HTTPException(status_code=400, detail="No content to summarize")

    context = "\n\n".join(chunks[:5])
    used_model = model or settings.default_model
    prompt = f"Summarize this document in a comprehensive but concise way (3-5 paragraphs):\n\n{context}"

    try:
        summary = await ollama_client.generate(model=used_model, prompt=prompt)
        doc.summary = summary
        await db.commit()
        return {"summary": summary, "cached": False}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


def _to_response(d: Document) -> DocumentResponse:
    return DocumentResponse(
        id=d.id, filename=d.filename, original_name=d.original_name,
        file_size=d.file_size, page_count=d.page_count, status=d.status,
        chunk_count=d.chunk_count, summary=d.summary, collection_id=d.collection_id,
        created_at=d.created_at,
    )

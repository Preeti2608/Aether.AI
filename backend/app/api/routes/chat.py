"""
Aether AI - Chat API Routes
Full ChatGPT-style chat with history, streaming, and RAG context injection
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import json

from app.core.database import get_db
from app.core.ollama_client import ollama_client
from app.core.config import get_settings
from app.models.chat import ChatSession, ChatMessage
from app.core.vector_store import semantic_search, upsert_embeddings
from loguru import logger

router = APIRouter(prefix="/chat", tags=["Chat"])
settings = get_settings()

SYSTEM_PROMPT = """You are Aether, a privacy-first AI assistant and personal second brain running entirely on your device.

Core behaviour:
- You are helpful, professional, and natural in tone.
- You have access to the user's stored memories and documents when relevant context is provided.
- When memories are provided in the Context section, reference them naturally — e.g. "Based on what you've told me…" or "Since you mentioned you like React…"
- Never say you "cannot remember" things or that you "don't have memory" — instead, simply answer based on what is in context or acknowledge when context is not available.
- Never mention OpenAI, ChatGPT, or any other AI product.
- Format responses using Markdown where appropriate: code blocks, headers, bullet lists.
- Be concise. Avoid unnecessary filler.
"""

MEMORY_EXTRACTION_PROMPT = """You are a memory extractor. Read the user message and extract any personal facts, preferences, projects, or goals the user has shared about themselves.

Rules:
- Extract only concrete, personal facts (name, skills, projects, preferences, goals).
- Return a JSON array of objects: [{{"fact": "...", "category": "fact|preference|project|personal|learning"}}]
- Return an empty array [] if nothing meaningful was shared.
- Do NOT extract questions, generic statements, or things about AI.
- Keep each fact short (under 120 characters).

User message: {message}

Return ONLY valid JSON, nothing else:"""


# ── Pydantic schemas ──────────────────────────────────────────────────────────
class MessageRequest(BaseModel):
    content: str
    session_id: Optional[str] = None
    model: Optional[str] = None
    use_memory: bool = True
    use_rag: bool = False
    document_id: Optional[str] = None


class SessionCreate(BaseModel):
    title: Optional[str] = "New Chat"
    model: Optional[str] = None


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime


class SessionResponse(BaseModel):
    id: str
    title: str
    model: str
    message_count: int
    created_at: datetime
    updated_at: datetime


# ── Session endpoints ──────────────────────────────────────────────────────────
@router.get("/sessions", response_model=List[SessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    """List all chat sessions ordered by most recent."""
    result = await db.execute(
        select(ChatSession).order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    output = []
    for s in sessions:
        msg_result = await db.execute(
            select(ChatMessage).where(ChatMessage.session_id == s.id)
        )
        count = len(msg_result.scalars().all())
        output.append(SessionResponse(
            id=s.id, title=s.title, model=s.model,
            message_count=count, created_at=s.created_at, updated_at=s.updated_at
        ))
    return output


@router.post("/sessions", response_model=SessionResponse)
async def create_session(data: SessionCreate, db: AsyncSession = Depends(get_db)):
    """Create a new chat session."""
    session = ChatSession(
        title=data.title or "New Chat",
        model=data.model or settings.default_model,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse(
        id=session.id, title=session.title, model=session.model,
        message_count=0, created_at=session.created_at, updated_at=session.updated_at
    )


@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
async def get_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get all messages for a session."""
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [MessageResponse(id=m.id, role=m.role, content=m.content, created_at=m.created_at) for m in messages]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a chat session and all its messages."""
    await db.execute(delete(ChatMessage).where(ChatMessage.session_id == session_id))
    await db.execute(delete(ChatSession).where(ChatSession.id == session_id))
    await db.commit()
    return {"message": "Session deleted"}


@router.patch("/sessions/{session_id}/title")
async def update_session_title(session_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    """Update session title."""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = data.get("title", session.title)
    session.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    return {"message": "Title updated"}


# ── Chat send message ──────────────────────────────────────────────────────────
@router.post("/send")
async def send_message(request: MessageRequest, db: AsyncSession = Depends(get_db)):
    """Send a message and get AI response (non-streaming)."""
    model = request.model or settings.default_model

    # Get or create session
    if request.session_id:
        result = await db.execute(select(ChatSession).where(ChatSession.id == request.session_id))
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = ChatSession(title=request.content[:50], model=model)
        db.add(session)
        await db.flush()

    # Build context from memory/RAG
    context_parts = []
    if request.use_memory:
        mem_results = semantic_search("aether_memories", request.content, n_results=3)
        if mem_results.get("documents") and mem_results["documents"][0]:
            memory_texts = "\n".join(f"- {doc}" for doc in mem_results["documents"][0])
            context_parts.append(f"Relevant memories:\n{memory_texts}")

    if request.use_rag and request.document_id:
        doc_results = semantic_search(
            "aether_documents", request.content, n_results=5,
            where={"document_id": request.document_id}
        )
        if doc_results.get("documents") and doc_results["documents"][0]:
            doc_texts = "\n\n".join(doc_results["documents"][0])
            context_parts.append(f"Relevant document content:\n{doc_texts}")

    # Get conversation history
    hist_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at)
    )
    history = hist_result.scalars().all()

    # Build messages for Ollama
    system = SYSTEM_PROMPT
    if context_parts:
        system += "\n\nContext:\n" + "\n\n".join(context_parts)

    ollama_messages = [{"role": m.role, "content": m.content} for m in history[-20:]]
    ollama_messages.append({"role": "user", "content": request.content})

    # Save user message
    user_msg = ChatMessage(session_id=session.id, role="user", content=request.content)
    db.add(user_msg)

    try:
        ai_response = await ollama_client.chat(
            model=model, messages=ollama_messages, system_prompt=system
        )
    except Exception as e:
        logger.error(f"Ollama error: {e}")
        raise HTTPException(status_code=503, detail=str(e))

    # Save assistant message
    assistant_msg = ChatMessage(session_id=session.id, role="assistant", content=ai_response)
    db.add(assistant_msg)
    session.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    if len(history) == 0:
        session.title = request.content[:60]
    await db.commit()
    await db.refresh(assistant_msg)

    # Auto-extract and store memories if memory mode is on
    if request.use_memory:
        await _extract_and_store_memories(request.content, model, db)

    return {
        "session_id": session.id,
        "message": MessageResponse(
            id=assistant_msg.id, role="assistant",
            content=ai_response, created_at=assistant_msg.created_at
        ),
        "user_message_id": user_msg.id
    }


@router.post("/send/stream")
async def send_message_stream(request: MessageRequest, db: AsyncSession = Depends(get_db)):
    """Send a message and stream AI response."""
    model = request.model or settings.default_model

    if request.session_id:
        result = await db.execute(select(ChatSession).where(ChatSession.id == request.session_id))
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = ChatSession(title=request.content[:50], model=model)
        db.add(session)
        await db.flush()
        await db.commit()

    # Build context
    context_parts = []
    if request.use_memory:
        mem_results = semantic_search("aether_memories", request.content, n_results=3)
        if mem_results.get("documents") and mem_results["documents"][0]:
            memory_texts = "\n".join(f"- {doc}" for doc in mem_results["documents"][0])
            context_parts.append(f"Relevant memories:\n{memory_texts}")

    hist_result = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at)
    )
    history = hist_result.scalars().all()
    system = SYSTEM_PROMPT
    if context_parts:
        system += "\n\nContext:\n" + "\n\n".join(context_parts)

    ollama_messages = [{"role": m.role, "content": m.content} for m in history[-20:]]
    ollama_messages.append({"role": "user", "content": request.content})

    # Save user message
    user_msg = ChatMessage(session_id=session.id, role="user", content=request.content)
    db.add(user_msg)
    await db.commit()

    use_memory_flag = request.use_memory

    async def generate():
        full_response = ""
        try:
            async for token in ollama_client.chat_stream(model=model, messages=ollama_messages, system_prompt=system):
                full_response += token
                yield f"data: {json.dumps({'token': token, 'session_id': session.id})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return

        # Save assistant message — create a fresh session from the module-level engine
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as save_session:
            assistant_msg = ChatMessage(session_id=session.id, role="assistant", content=full_response)
            save_session.add(assistant_msg)
            s_result = await save_session.execute(select(ChatSession).where(ChatSession.id == session.id))
            s = s_result.scalar_one_or_none()
            if s:
                s.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                if len(history) == 0:
                    s.title = request.content[:60]
            await save_session.commit()

        # Auto-extract memories (fire and forget — errors logged, not raised)
        if use_memory_flag:
            try:
                from app.core.database import AsyncSessionLocal as _ASL
                async with _ASL() as mem_session:
                    await _extract_and_store_memories(request.content, model, mem_session)
            except Exception as e:
                logger.warning(f"Memory extraction failed: {e}")

        yield f"data: {json.dumps({'done': True, 'session_id': session.id})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


async def _extract_and_store_memories(user_message: str, model: str, db: AsyncSession) -> None:
    """Extract personal facts from a user message and store as memories."""
    import re
    from app.core.vector_store import upsert_embeddings as _upsert
    from app.models.memory import Memory

    # Skip short/generic messages unlikely to contain personal facts
    if len(user_message.strip()) < 10:
        return

    try:
        prompt = MEMORY_EXTRACTION_PROMPT.format(message=user_message)
        raw = await ollama_client.generate(model=model, prompt=prompt)

        # Robustly extract JSON from model output (may include markdown fences)
        raw = raw.strip()
        # Strip markdown code fences if present
        raw = re.sub(r'^```[a-zA-Z]*\n?', '', raw)
        raw = re.sub(r'\n?```$', '', raw)
        raw = raw.strip()

        facts = json.loads(raw)
        if not isinstance(facts, list) or len(facts) == 0:
            return

        for item in facts:
            if not isinstance(item, dict) or not item.get("fact"):
                continue
            fact_text = str(item["fact"])[:500]
            category = str(item.get("category", "general"))
            if category not in ("fact", "preference", "project", "personal", "learning", "general"):
                category = "general"

            # Avoid storing duplicates — check for semantic near-duplicate via DB
            from sqlalchemy import func as sqlfunc
            existing = await db.execute(
                select(Memory).where(Memory.content == fact_text).limit(1)
            )
            if existing.scalar_one_or_none():
                continue

            mem = Memory(
                content=fact_text,
                category=category,
                source="chat",
                tags="auto-extracted",
            )
            db.add(mem)
            await db.flush()

            try:
                _upsert(
                    "aether_memories",
                    ids=[mem.id],
                    texts=[fact_text],
                    metadatas=[{"category": category, "source": "chat", "tags": "auto-extracted", "collection_id": ""}],
                )
            except Exception as e:
                logger.warning(f"Failed to embed auto-extracted memory: {e}")

        await db.commit()
        logger.debug(f"Auto-extracted {len(facts)} memories from user message")

    except (json.JSONDecodeError, Exception) as e:
        # Silently swallow — extraction is best-effort
        logger.debug(f"Memory extraction skipped: {e}")

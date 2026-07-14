"""
Aether AI - FastAPI Application Entry Point
Privacy-first, offline AI Second Brain powered by local LLMs
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger
import sys

from app.core.config import get_settings
from app.core.database import init_db
from app.api.routes import chat, memory, notes, documents, collections, search, dashboard

settings = get_settings()

# Configure logging
logger.remove()
logger.add(sys.stdout, level="DEBUG" if settings.debug else "INFO",
           format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level}</level> | {message}")
logger.add("logs/aether.log", rotation="10 MB", retention="7 days", level="INFO")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("🚀 Starting Aether AI Backend...")

    # Ensure data directories exist
    os.makedirs("data/uploads", exist_ok=True)
    os.makedirs("data/chroma_db", exist_ok=True)
    os.makedirs("logs", exist_ok=True)

    # Initialize database
    await init_db()
    logger.info("✅ Database initialized")

    # Seed default collections
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.collections import Collection
        from sqlalchemy import select
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Collection))
            if not result.scalars().first():
                from app.api.routes.collections import DEFAULT_COLLECTIONS
                for col_data in DEFAULT_COLLECTIONS:
                    session.add(Collection(**col_data))
                await session.commit()
                logger.info("✅ Default collections seeded")
    except Exception as e:
        logger.warning(f"Collection seeding failed: {e}")

    # Check Ollama
    from app.core.ollama_client import ollama_client
    is_online = await ollama_client.health_check()
    if is_online:
        models = await ollama_client.list_models()
        model_names = [m.get("name") for m in models]
        logger.info(f"✅ Ollama is online. Available models: {model_names}")
    else:
        logger.warning("⚠️  Ollama is offline. Start Ollama to enable AI features.")

    logger.info(f"✅ Aether AI Backend ready on http://{settings.host}:{settings.port}")
    yield

    logger.info("Shutting down Aether AI...")


app = FastAPI(
    title="Aether AI",
    description="Privacy-first, offline AI Second Brain powered by local LLMs",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router, prefix="/api/v1")
app.include_router(memory.router, prefix="/api/v1")
app.include_router(notes.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(collections.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(dashboard.settings_router, prefix="/api/v1")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    from app.core.ollama_client import ollama_client
    ai_online = await ollama_client.health_check()
    return {
        "status": "healthy",
        "version": settings.app_version,
        "ai_online": ai_online,
    }


@app.get("/")
async def root():
    return {"message": "Aether AI API", "version": settings.app_version, "docs": "/api/docs"}

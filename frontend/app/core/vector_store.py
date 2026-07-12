"""
Aether AI - ChromaDB Vector Store
Manages vector embeddings for semantic search using ChromaDB
"""
import chromadb
from sentence_transformers import SentenceTransformer
from app.core.config import get_settings
from loguru import logger
from typing import List, Dict, Any, Optional
import os

settings = get_settings()

# Global instances
_chroma_client: Optional[chromadb.ClientAPI] = None
_embedding_model: Optional[SentenceTransformer] = None

COLLECTIONS = {
    "memories": "aether_memories",
    "notes": "aether_notes",
    "documents": "aether_documents",
    "chat_history": "aether_chat_history",
}


def get_chroma_client() -> chromadb.ClientAPI:
    """Get or create ChromaDB client."""
    global _chroma_client
    if _chroma_client is None:
        os.makedirs(settings.chroma_db_path, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_db_path,
        )
        logger.info(f"ChromaDB initialized at {settings.chroma_db_path}")
    return _chroma_client


def get_embedding_model() -> SentenceTransformer:
    """Get or load the sentence transformer model."""
    global _embedding_model
    if _embedding_model is None:
        try:
            _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Embedding model loaded: all-MiniLM-L6-v2")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    return _embedding_model


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts."""
    model = get_embedding_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return embeddings.tolist()


def get_or_create_collection(name: str) -> chromadb.Collection:
    """Get or create a ChromaDB collection."""
    client = get_chroma_client()
    collection = client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )
    return collection


def upsert_embeddings(
    collection_name: str,
    ids: List[str],
    texts: List[str],
    metadatas: Optional[List[Dict[str, Any]]] = None,
):
    """Upsert text embeddings into ChromaDB collection."""
    collection = get_or_create_collection(collection_name)
    embeddings = embed_texts(texts)
    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas or [{} for _ in texts],
    )
    logger.debug(f"Upserted {len(ids)} embeddings into '{collection_name}'")


def semantic_search(
    collection_name: str,
    query: str,
    n_results: int = 10,
    where: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Perform semantic similarity search."""
    try:
        collection = get_or_create_collection(collection_name)
        query_embedding = embed_texts([query])[0]
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(n_results, collection.count() or 1),
            where=where,
            include=["documents", "metadatas", "distances"],
        )
        return results
    except Exception as e:
        logger.error(f"Semantic search failed: {e}")
        return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}


def delete_from_collection(collection_name: str, ids: List[str]):
    """Delete items from a ChromaDB collection."""
    collection = get_or_create_collection(collection_name)
    collection.delete(ids=ids)
    logger.debug(f"Deleted {len(ids)} items from '{collection_name}'")

"""
Aether AI - Application Configuration
Central settings management using pydantic-settings
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field
import json


class Settings(BaseSettings):
    # App
    app_name: str = "Aether AI"
    app_version: str = "1.0.0"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # Ollama
    ollama_base_url: str = "http://localhost:11434"
    default_model: str = "phi3"
    embedding_model: str = "nomic-embed-text"

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/aether.db"

    # ChromaDB
    chroma_db_path: str = "./data/chroma_db"

    # Uploads
    upload_dir: str = "./data/uploads"
    max_upload_size_mb: int = 50

    # CORS
    cors_origins: str = '["http://localhost:5173","http://localhost:3000"]'

    def get_cors_origins(self) -> List[str]:
        try:
            return json.loads(self.cors_origins)
        except Exception:
            return ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()

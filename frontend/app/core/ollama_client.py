"""
Aether AI - Ollama Client
Handles communication with local Ollama LLM service
"""
import httpx
import json
from typing import AsyncGenerator, List, Dict, Any, Optional
from app.core.config import get_settings
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

settings = get_settings()


class OllamaClient:
    """Async client for Ollama API."""

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.timeout = httpx.Timeout(120.0, connect=10.0)

    async def list_models(self) -> List[Dict[str, Any]]:
        """List all available Ollama models."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                response.raise_for_status()
                data = response.json()
                return data.get("models", [])
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {e}")
            return []

    async def health_check(self) -> bool:
        """Check if Ollama is running."""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False

    async def chat(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> str:
        """Send chat request to Ollama and return complete response."""
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("message", {}).get("content", "")
        except httpx.TimeoutException:
            raise RuntimeError("Ollama request timed out. The model may be loading.")
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Ollama HTTP error: {e.response.status_code}")
        except Exception as e:
            raise RuntimeError(f"Ollama communication error: {str(e)}")

    async def chat_stream(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Stream chat response from Ollama token by token."""
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature},
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST", f"{self.base_url}/api/chat", json=payload
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                token = data.get("message", {}).get("content", "")
                                if token:
                                    yield token
                                if data.get("done"):
                                    break
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            raise RuntimeError(f"Streaming failed: {str(e)}")

    async def generate(
        self,
        model: str,
        prompt: str,
        system_prompt: Optional[str] = None,
    ) -> str:
        """Generate a completion from a prompt."""
        return await self.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            system_prompt=system_prompt,
        )


# Singleton instance
ollama_client = OllamaClient()

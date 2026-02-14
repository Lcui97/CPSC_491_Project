"""
OpenAI: embeddings and node generation (summaries, concepts, relationships).
When OPENAI_API_KEY is not set, runs in local-only mode: stub embeddings, simple text extraction for nodes.
"""
import os
import json
from typing import List, Dict, Any

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

_client = None
# Stub embedding dimension (text-embedding-3-small); used when OpenAI is not configured
EMBEDDING_DIM = 1536


def _has_openai() -> bool:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    return bool(key and OpenAI is not None)


def _get_client():
    global _client
    if _client is None:
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("OPENAI_API_KEY not set")
        if OpenAI is None:
            raise RuntimeError("openai package required: pip install openai")
        _client = OpenAI(api_key=key)
    return _client


def get_embedding(text: str, model: str = "text-embedding-3-small") -> List[float]:
    """Return embedding vector for a single text. Stub (zeros) when OpenAI not configured."""
    if not _has_openai():
        return [0.0] * EMBEDDING_DIM
    client = _get_client()
    r = client.embeddings.create(input=[text], model=model)
    return r.data[0].embedding


def get_embeddings_batch(texts: List[str], model: str = "text-embedding-3-small") -> List[List[float]]:
    """Return embedding vectors for multiple texts. Stubs when OpenAI not configured."""
    if not texts:
        return []
    if not _has_openai():
        return [[0.0] * EMBEDDING_DIM for _ in texts]
    client = _get_client()
    r = client.embeddings.create(input=texts, model=model)
    by_idx = {item.index: item.embedding for item in r.data}
    return [by_idx[i] for i in range(len(texts))]


NODE_GEN_SYSTEM = """You are a knowledge graph assistant. Given a chunk of textbook or note content, output a JSON object with:
- "title": short descriptive title (string)
- "summary": 2-4 sentence summary (string)
- "concepts": list of key concepts/terms (list of strings)
- "related_topics": list of topic phrases that might link to other nodes (list of strings, for linking)

Output only valid JSON, no markdown code fence."""


def _local_node_from_chunk(chunk_text: str, section_title: str | None = None) -> Dict[str, Any]:
    """Local-only: derive title and summary from text without OpenAI."""
    text = (chunk_text or "").strip()[:8000]
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    title = section_title or (lines[0][:200] if lines else "Untitled")
    summary = (lines[0][:300] if lines else "") or text[:300]
    return {
        "title": title,
        "summary": summary,
        "concepts": [],
        "related_topics": [],
    }


def generate_node_from_chunk(chunk_text: str, section_title: str | None = None) -> Dict[str, Any]:
    """
    Call ChatGPT to produce structured node fields from one chunk.
    When OpenAI is not configured, returns simple title/summary from text (local-only).
    """
    if not _has_openai():
        return _local_node_from_chunk(chunk_text, section_title)
    client = _get_client()
    user_content = chunk_text[:8000]
    if section_title:
        user_content = f"Section: {section_title}\n\n{user_content}"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": NODE_GEN_SYSTEM},
            {"role": "user", "content": user_content},
        ],
        temperature=0.3,
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


def generate_markdown_structure(ocr_text: str) -> str:
    """
    Clean and structure OCR output into Markdown. When OpenAI not configured, returns text as-is.
    """
    if not _has_openai():
        return (ocr_text or "").strip()
    client = _get_client()
    system = """You are an assistant that turns raw OCR text from handwritten notes into clean, structured Markdown.
Use: headings (##), bullet points (-), numbered lists, **bold** for terms, and clear paragraph breaks.
If you see equations, use inline math in $...$ or block $$...$$ where appropriate.
Output only the Markdown, no explanation."""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": ocr_text[:12000]},
        ],
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()

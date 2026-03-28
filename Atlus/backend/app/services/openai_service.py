"""Embeddings + LLM helpers for nodes and chat. Without an API key we fake vectors and keep things runnable."""
import base64
import io
import os
import json
import re
from typing import List, Dict, Any, Tuple

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

_client = None
# Matches text-embedding-3-small — zero vector when we're stubbing
EMBEDDING_DIM = 1536


def _has_openai() -> bool:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    return bool(key and OpenAI is not None)


def _get_client():
    global _client
    if _client is None:
        key = (os.environ.get("OPENAI_API_KEY") or "").strip()
        if not key:
            raise RuntimeError("OPENAI_API_KEY not set")
        if OpenAI is None:
            raise RuntimeError("openai package required: pip install openai")
        _client = OpenAI(api_key=key)
    return _client


def get_embedding(text: str, model: str = "text-embedding-3-small") -> List[float]:
    """One embedding; all zeros if we're not calling the API."""
    if not _has_openai():
        return [0.0] * EMBEDDING_DIM
    client = _get_client()
    r = client.embeddings.create(input=[text], model=model)
    return r.data[0].embedding


def get_embeddings_batch(texts: List[str], model: str = "text-embedding-3-small") -> List[List[float]]:
    """Batch version of get_embedding; stubbed zeros if no key."""
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
    """Offline fallback: first line-ish title + blurb, no LLM."""
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
    """JSON shape for one chunk from the small model, or _local_node_from_chunk if we're offline."""
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


def _prepare_image_bytes_for_vision(image_bytes: bytes) -> Tuple[bytes, str]:
    """Flatten alpha → RGB, shrink huge scans, JPEG for the vision endpoint."""
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        background = Image.new("RGB", img.size, (255, 255, 255))
        rgba = img.convert("RGBA")
        background.paste(rgba, mask=rgba.split()[3])
        img = background
    else:
        img = img.convert("RGB")

    max_side = int((os.environ.get("OCR_IMAGE_MAX_SIDE") or "3072").strip() or "3072")
    w, h = img.size
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)

    out = io.BytesIO()
    quality = int((os.environ.get("OCR_JPEG_QUALITY") or "90").strip() or "90")
    quality = max(60, min(quality, 100))
    img.save(out, format="JPEG", quality=quality, optimize=True)
    return out.getvalue(), "image/jpeg"


VISION_HANDWRITING_SYSTEM = """You transcribe handwritten notes from images into clean, editable Markdown.

Rules:
- Read the page carefully and copy the content faithfully. Do not invent words or facts.
- If something is unreadable, write [illegible] instead of guessing.
- Preserve structure: use ## or ### for headings, - for bullets, 1. for numbered lists; indent nested items.
- Use **bold** for clear emphasis or defined terms on the page.
- For math, use inline $...$ or block $$...$$ when you see equations or formulas.
- For simple tables or two-column layout, use a Markdown table or headings if it improves clarity.

Output ONLY the Markdown document. No preamble, no closing commentary. Do not wrap the answer in a ``` code fence."""


def handwriting_image_to_markdown(image_bytes: bytes, filename: str = "") -> Tuple[str, str]:
    """Vision model → markdown plus a stripped preview string for the UI."""
    if not _has_openai():
        raise RuntimeError("OPENAI_API_KEY required for vision handwriting OCR")

    jpeg_bytes, mime = _prepare_image_bytes_for_vision(image_bytes)
    model = (os.environ.get("OCR_VISION_MODEL") or "gpt-4o").strip() or "gpt-4o"
    b64 = base64.standard_b64encode(jpeg_bytes).decode("ascii")
    data_url = f"data:{mime};base64,{b64}"

    client = _get_client()
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": VISION_HANDWRITING_SYSTEM},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Transcribe this handwritten page into Markdown following the rules above.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": data_url, "detail": "high"},
                    },
                ],
            },
        ],
        temperature=0.1,
        max_tokens=8192,
    )
    markdown = (response.choices[0].message.content or "").strip()
    if markdown.startswith("```"):
        markdown = re.sub(r"^```(?:markdown|md)?\s*\n?", "", markdown, flags=re.IGNORECASE)
        markdown = re.sub(r"\n?```\s*$", "", markdown).strip()

    plain = re.sub(r"#+\s*", "", markdown)
    plain = re.sub(r"\*\*([^*]+)\*\*", r"\1", plain)
    plain = re.sub(r"`([^`]+)`", r"\1", plain)
    plain_preview = plain.strip()[:5000]

    return markdown, plain_preview


def generate_markdown_structure(ocr_text: str) -> str:
    """Pretty-print noisy OCR; passthrough if we can't call the API."""
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


# System prompts for the /ask modes
SUMMARY_SYSTEM = """You are a study assistant. Given notes and documents from the user's knowledge base, produce a clear, concise summary. Use bullet points or short paragraphs. Focus on main ideas and key facts. Output only the summary, no preamble."""

STUDY_GUIDE_SYSTEM = """You are a study assistant. Given notes and documents, create a study guide: key concepts, definitions, and main takeaways. Use headings and bullet points. Output only the study guide."""

KEY_POINTS_SYSTEM = """You are a study assistant. Given notes and documents, list the key points or main takeaways in a concise bullet list. Output only the list."""


def ask_brain(context_text: str, user_prompt: str, mode: str = "custom") -> str:
    """Stuff context + user question into chat; picks system prompt from mode."""
    if not _has_openai():
        return "OpenAI is not configured. Add OPENAI_API_KEY to your environment to use summaries and study guides."

    system_map = {
        "summary": SUMMARY_SYSTEM,
        "study_guide": STUDY_GUIDE_SYSTEM,
        "key_points": KEY_POINTS_SYSTEM,
    }
    system = system_map.get(mode)
    if not system:
        system = "You are a study assistant. Answer based on the following notes and documents. Be concise and accurate. Output only the response."

    # Cap context to avoid token limits (roughly 8k chars for gpt-4o-mini)
    context = (context_text or "").strip()[:24000]

    client = _get_client()
    user_content = f"Notes and documents:\n\n{context}\n\n---\n\nUser request: {user_prompt.strip() or 'Summarize the above.'}"
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()

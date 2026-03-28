"""Pull deadlines out of syllabus text (LLM + sanity checks)."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.services.docx_extractor import extract_text_from_docx_bytes
from app.services.pdf_extractor import extract_text_from_pdf_bytes
from app.services.pptx_extractor import extract_text_from_pptx_bytes
from app.services.openai_service import _has_openai, _get_client

ALLOWED_EVENT_TYPES = {"quiz", "midterm", "test", "project", "assignment", "final", "other"}

EVENT_EXTRACTION_SYSTEM = """You extract assessment deadlines from course syllabi.
Return ONLY valid JSON in this exact shape:
{
  "events": [
    {
      "title": "Midterm 1",
      "event_type": "midterm",
      "due_at": "2026-10-14T23:59:00Z",
      "course_label": "CPSC 491",
      "confidence": 0.92,
      "notes": "Chapter 1-6"
    }
  ]
}

Rules:
- Include only quizzes, midterms, tests, projects, assignments, finals.
- Use event_type from: quiz, midterm, test, project, assignment, final, other.
- Convert dates into ISO-8601 UTC timestamps.
- If a date is missing/ambiguous, do not include that event.
- confidence must be between 0 and 1.
- No markdown code fences.
"""


def syllabus_text_from_file(filename: str, file_bytes: bytes) -> str:
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if ext == "pdf":
        return extract_text_from_pdf_bytes(file_bytes)
    if ext == "docx":
        return extract_text_from_docx_bytes(file_bytes)
    if ext == "pptx":
        return extract_text_from_pptx_bytes(file_bytes)
    return file_bytes.decode("utf-8", errors="replace")


def _parse_due_at(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%b %d %Y", "%B %d %Y"):
        try:
            dt = datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            continue
    return None


def _normalize_event(item: Dict[str, Any]) -> Dict[str, Any] | None:
    title = str(item.get("title") or "").strip()[:512]
    if not title:
        return None
    event_type = str(item.get("event_type") or "other").strip().lower()
    if event_type not in ALLOWED_EVENT_TYPES:
        event_type = "other"
    due_at = _parse_due_at(item.get("due_at"))
    if not due_at:
        return None
    confidence = item.get("confidence")
    try:
        confidence = float(confidence) if confidence is not None else None
    except Exception:
        confidence = None
    if confidence is not None:
        confidence = max(0.0, min(confidence, 1.0))
    return {
        "title": title,
        "event_type": event_type,
        "due_at": due_at,
        "course_label": str(item.get("course_label") or "").strip()[:128] or None,
        "confidence": confidence,
        "notes": str(item.get("notes") or "").strip() or None,
    }


def _fallback_parse(text: str) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    date_re = re.compile(r"(\d{1,2}/\d{1,2}/\d{2,4}|\d{4}-\d{2}-\d{2})")
    for ln in lines[:500]:
        low = ln.lower()
        kind = None
        for label in ("midterm", "quiz", "test", "project", "assignment", "final"):
            if label in low:
                kind = label
                break
        if not kind:
            continue
        m = date_re.search(ln)
        if not m:
            continue
        due_at = _parse_due_at(m.group(1))
        if not due_at:
            continue
        results.append(
            {
                "title": ln[:512],
                "event_type": kind if kind in ALLOWED_EVENT_TYPES else "other",
                "due_at": due_at,
                "course_label": None,
                "confidence": 0.45,
                "notes": "Extracted with fallback parser",
            }
        )
    return results


def extract_calendar_events(text: str) -> List[Dict[str, Any]]:
    text = (text or "").strip()
    if not text:
        return []
    if not _has_openai():
        return _fallback_parse(text)
    client = _get_client()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.1,
        messages=[
            {"role": "system", "content": EVENT_EXTRACTION_SYSTEM},
            {"role": "user", "content": text[:45000]},
        ],
    )
    raw = (response.choices[0].message.content or "").strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    payload = json.loads(raw)
    items = payload.get("events") if isinstance(payload, dict) else []
    out: List[Dict[str, Any]] = []
    if isinstance(items, list):
        for item in items:
            if not isinstance(item, dict):
                continue
            n = _normalize_event(item)
            if n:
                out.append(n)
    return out

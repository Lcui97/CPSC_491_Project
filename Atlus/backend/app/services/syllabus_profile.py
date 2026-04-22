"""Extract class metadata from syllabus text (LLM + regex fallback)."""
from __future__ import annotations

import json
import re
from typing import Any, Dict

from app.services.openai_service import _has_openai, _get_client

PROFILE_SYSTEM = """You extract class metadata from a syllabus.
Return ONLY valid JSON in this exact shape:
{
  "class_title": "Intro to Software Engineering",
  "class_number": "CPSC 491",
  "section": "11",
  "professor": "Dr. Jane Smith",
  "meeting_days": "Monday/Wednesday",
  "meeting_time": "9:00 AM - 11:45 AM",
  "classroom": "CS-201",
  "office_hours": "Tue 2:00 PM - 4:00 PM",
  "term": "Spring 2026"
}

Rules:
- Use null when a value is missing.
- Do not invent data.
- Output JSON only, no markdown fences.

meeting_days (lecture / lab meetings):
- Always expand abbreviations into explicit weekday names separated by "/" or commas.
  Examples: MoWe or MW → "Monday/Wednesday"; TuTh or TR or T,R → "Tuesday/Thursday"; MWF → "Monday/Wednesday/Friday".
- US registrar shorthand: second letter alone often means Thursday (e.g. TR = Tue+Thu); R alone after T means Thursday, not Tuesday.
- Do not leave ambiguous strings like "MoWe", "TuTh", "TR", or single letters — spell out Mon, Tue, Wed, Thu, Fri, Sat, Sun.
"""


def _clean(value: Any, max_len: int = 255) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text[:max_len] if text else None


def _fallback_extract(text: str) -> Dict[str, Any]:
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]
    blob = "\n".join(lines[:400])

    class_number = None
    m = re.search(r"\b([A-Z]{2,5}\s*\d{3}[A-Z]?)\b", blob)
    if m:
        class_number = m.group(1).replace("  ", " ").strip()

    section = None
    m = re.search(r"\bsection[:\s-]*([0-9A-Za-z-]+)\b", blob, re.IGNORECASE)
    if m:
        section = m.group(1).strip()

    professor = None
    for pat in [
        r"(?:instructor|professor)[:\s-]+([^\n,]+)",
        r"\bDr\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?",
    ]:
        mm = re.search(pat, blob, re.IGNORECASE)
        if mm:
            professor = mm.group(1).strip() if mm.lastindex else mm.group(0).strip()
            break

    term = None
    m = re.search(r"\b(Spring|Summer|Fall|Winter)\s+20\d{2}\b", blob, re.IGNORECASE)
    if m:
        term = m.group(0)

    meeting_days = None
    meeting_time = None
    m = re.search(
        r"\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?(?:\s*/\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?)?(?:\s+|\s*[:\-]\s*)(\d{1,2}:\d{2}\s*(?:AM|PM)\s*(?:-|to)\s*\d{1,2}:\d{2}\s*(?:AM|PM))",
        blob,
        re.IGNORECASE,
    )
    if m:
        meeting_days = m.group(1) + (f"/{m.group(2)}" if m.group(2) else "")
        meeting_time = m.group(3)

    classroom = None
    m = re.search(r"\b(?:room|classroom|location)[:\s-]+([^\n,]+)", blob, re.IGNORECASE)
    if m:
        classroom = m.group(1).strip()

    office_hours = None
    m = re.search(r"\boffice\s*hours?[:\s-]+([^\n]+)", blob, re.IGNORECASE)
    if m:
        office_hours = m.group(1).strip()

    class_title = lines[0][:255] if lines else None
    return {
        "class_title": class_title,
        "class_number": class_number,
        "section": section,
        "professor": professor,
        "meeting_days": meeting_days,
        "meeting_time": meeting_time,
        "classroom": classroom,
        "office_hours": office_hours,
        "term": term,
    }


def extract_syllabus_profile(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    if not text:
        return {
            "class_title": None,
            "class_number": None,
            "section": None,
            "professor": None,
            "meeting_days": None,
            "meeting_time": None,
            "classroom": None,
            "office_hours": None,
            "term": None,
        }

    payload = None
    if _has_openai():
        client = _get_client()
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.0,
            messages=[
                {"role": "system", "content": PROFILE_SYSTEM},
                {"role": "user", "content": text[:45000]},
            ],
        )
        raw = (resp.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        try:
            payload = json.loads(raw)
        except Exception:
            payload = None

    if not isinstance(payload, dict):
        payload = _fallback_extract(text)

    return {
        "class_title": _clean(payload.get("class_title"), 255),
        "class_number": _clean(payload.get("class_number"), 64),
        "section": _clean(payload.get("section"), 64),
        "professor": _clean(payload.get("professor"), 255),
        "meeting_days": _clean(payload.get("meeting_days"), 128),
        "meeting_time": _clean(payload.get("meeting_time"), 128),
        "classroom": _clean(payload.get("classroom"), 128),
        "office_hours": _clean(payload.get("office_hours"), 255),
        "term": _clean(payload.get("term"), 128),
    }

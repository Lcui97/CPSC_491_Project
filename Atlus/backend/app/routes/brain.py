# routes under /api/brain (also some /classes stuff)

import mimetypes
import os
import re
import uuid
import threading
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from io import BytesIO
from pathlib import Path

from flask import Blueprint, request, jsonify, current_app, send_file
from sqlalchemy import or_
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.datastructures import FileStorage

from app.extensions import db
from app.models.brain import (
    Brain,
    BrainCollaborator,
    BrainShareLink,
    CalendarEvent,
    CourseProfile,
    Node,
    SourceFile,
)
from app.models.user import User

bp = Blueprint("brain", __name__)


def _get_user_or_404():
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return None
    user = User.query.get(user_id)
    if not user:
        return None
    return user


def _classes_assistant_notes_section(brain_map: dict, brain_ids: list, *, max_chars: int = 12000, per_note_cap: int = 3200) -> str:
    # grabs recent notes from all ur classes for the planner bot (skip syllabus-only junk)
    rows = (
        Node.query.filter(Node.brain_id.in_(brain_ids))
        .filter(
            or_(
                Node.node_type.in_(("note", "handwritten", "textbook_section")),
                Node.node_type.is_(None),
            )
        )
        .order_by(Node.updated_at.desc().nullslast(), Node.created_at.desc())
        .limit(100)
        .all()
    )
    parts: list[str] = []
    total = 0
    sep = "\n\n---\n\n"
    for n in rows:
        body = (n.markdown_content or n.raw_content or "").strip()
        if not body:
            continue
        b = brain_map.get(n.brain_id)
        course = b.name if b else str(n.brain_id)
        title = (n.title or "Untitled").strip()
        chunk = f"### {course} — {title}\n{body[:per_note_cap]}"
        add_len = len(chunk) + (len(sep) if parts else 0)
        if total + add_len > max_chars:
            break
        parts.append(chunk)
        total += add_len
    if not parts:
        return "No notes yet — only syllabus and calendar data above apply."
    return "\n\n---\n\n".join(parts)


def _datetime_anchor_block(now_utc=None) -> str:
    # datetime junk for the backend prompt so it knows what "today" is - not shown to user
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)
    tz_name = (os.environ.get("ATLUS_TIMEZONE") or "UTC").strip() or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz_name = "UTC"
        tz = ZoneInfo("UTC")
    local = now_utc.astimezone(tz)
    iso_year, iso_week, _ = local.isocalendar()
    lines = [
        "[INTERNAL_REFERENCE — do not quote, summarize, or reproduce this block in your reply unless the user explicitly asks what time or date it is right now.]",
        'Use only for interpreting phrases like "today", "this week", "tomorrow", and "next Monday".',
        "Do not assume the current term starts in January (or any month) just because the syllabus says so — compare syllabus dates to the actual calendar facts below.",
        f"- Reference timezone: {tz_name} (env ATLUS_TIMEZONE).",
        f"- Now (local): {local.strftime('%A, %B %d, %Y at %H:%M (%Z)')}",
        f"- ISO (local): {local.isoformat(timespec='minutes')}",
        f"- Same instant (UTC): {now_utc.strftime('%Y-%m-%d %H:%M:%S')} UTC",
        f"- ISO week: {iso_year}-W{iso_week:02d} (weeks start Monday).",
        "",
    ]
    return "\n".join(lines)


def _brain_for_user(brain_id, user_id):
    # None if wrong person
    brain = Brain.query.filter_by(id=brain_id).first()
    if not brain:
        return None
    if brain.user_id == user_id:
        return brain
    if BrainCollaborator.query.filter_by(brain_id=brain_id, user_id=user_id).first():
        return brain
    return None


def _upload_root():
    return Path(current_app.root_path).parent / current_app.config.get("UPLOAD_FOLDER", "uploads")


def _persist_upload_bytes(brain_id: str, filename: str, data: bytes) -> str:
    # dumps bytes into uploads/{id}/whatever
    upload_root = _upload_root()
    brain_dir = upload_root / brain_id
    brain_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(filename or "upload.bin").name
    ext = Path(safe_name).suffix or ".bin"
    stored = f"{uuid.uuid4().hex}{ext}"
    disk_path = brain_dir / stored
    with open(disk_path, "wb") as f:
        f.write(data)
    return str(Path(brain_id) / stored)


def _event_to_json(e: CalendarEvent):
    return {
        "id": e.id,
        "brain_id": e.brain_id,
        "source_file_id": e.source_file_id,
        "title": e.title,
        "event_type": e.event_type,
        "due_at": e.due_at.isoformat() if e.due_at else None,
        "course_label": e.course_label,
        "confidence": e.confidence,
        "notes": e.notes,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


def _profile_to_json(profile: CourseProfile | None):
    if not profile:
        return None
    return {
        "professor": profile.professor,
        "class_number": profile.class_number,
        "section": profile.section,
        "meeting_days": profile.meeting_days,
        "meeting_time": profile.meeting_time,
        "classroom": profile.classroom,
        "office_hours": profile.office_hours,
        "term": profile.term,
    }


def _class_title_for_brain(brain: Brain, profile: CourseProfile | None):
    if brain and brain.name:
        return brain.name
    if profile and profile.class_number:
        return profile.class_number
    return "Untitled Class"


def _class_to_json(brain: Brain, profile: CourseProfile | None, event_count: int = 0):
    return {
        "id": brain.id,
        "title": _class_title_for_brain(brain, profile),
        "created_at": brain.created_at.isoformat() if brain.created_at else None,
        "profile": _profile_to_json(profile),
        "event_count": int(event_count or 0),
    }


def _extract_syllabus_sections(text: str):
    # hacky regex to grab a few headings for preview - not perfect
    raw = (text or "").strip()
    if not raw:
        return []

    patterns = [
        ("Course info", r"(course description|catalog description|instructor|professor|office hours|meeting|location)"),
        ("Grading", r"(grading|grade breakdown|points|weights|assessment|rubric)"),
        ("Policies", r"(policy|attendance|late work|academic integrity|plagiarism|conduct|accommodation)"),
        ("Schedule / Weekly plan", r"(schedule|calendar|week \d+|tentative|topics|lecture plan)"),
    ]

    lines = [ln.rstrip() for ln in raw.splitlines()]
    sections = []
    for title, pat in patterns:
        regex = re.compile(pat, re.IGNORECASE)
        idx = next((i for i, ln in enumerate(lines) if regex.search(ln)), None)
        if idx is None:
            continue
        chunk = "\n".join(lines[idx : min(len(lines), idx + 22)]).strip()
        if chunk:
            sections.append({"title": title, "content": chunk[:4000]})

    if not sections:
        sections.append({"title": "Syllabus excerpt", "content": raw[:6000]})
    return sections


def _syllabus_node_markdown(text: str):
    # tries openai prettify then gives up and uses raw text
    source = (text or "").strip()
    if not source:
        return ""
    try:
        from app.services.openai_service import format_syllabus_markdown

        formatted = (format_syllabus_markdown(source) or "").strip()
        return formatted or source
    except Exception:
        return source


def _upsert_course_profile(brain_id: str, data: dict):
    profile = CourseProfile.query.filter_by(brain_id=brain_id).first()
    if not profile:
        profile = CourseProfile(brain_id=brain_id)
        db.session.add(profile)
    profile.professor = (data.get("professor") or "").strip()[:255] or None
    profile.class_number = (data.get("class_number") or "").strip()[:64] or None
    profile.section = (data.get("section") or "").strip()[:64] or None
    profile.meeting_days = (data.get("meeting_days") or "").strip()[:128] or None
    profile.meeting_time = (data.get("meeting_time") or "").strip()[:128] or None
    profile.classroom = (data.get("classroom") or "").strip()[:128] or None
    profile.office_hours = (data.get("office_hours") or "").strip()[:255] or None
    profile.term = (data.get("term") or "").strip()[:128] or None
    return profile


def _parse_datetime_value(value):
    if not isinstance(value, str) or not value.strip():
        return None
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except Exception:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


# new workspace - json or multipart. sqlite cant really thread file ingest so sometimes its sync
@bp.route("/brain/create", methods=["POST"])
@jwt_required()
def create_brain():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    # json vs form upload
    if request.is_json:
        data = request.get_json() or {}
        name = (data.get("name") or "").strip() or "New Brain"
        badge = (data.get("badge") or "Notes").strip()
        files = []
    else:
        name = (request.form.get("name") or "").strip() or "New Brain"
        badge = (request.form.get("badge") or "Notes").strip()
        files = request.files.getlist("files[]") or request.files.getlist("files") or []

    brain_id = str(uuid.uuid4())
    brain = Brain(id=brain_id, name=name, badge=badge, user_id=user.id)
    db.session.add(brain)
    db.session.commit()

    try:
        from app.services.seed_nodes import ensure_seed_nodes
        ensure_seed_nodes(brain_id)
    except Exception:
        pass

    # read files now bc after we return the stream is gone
    if files:
        import io
        file_payloads = []
        for f in files:
            if not f or not getattr(f, "filename", None):
                continue
            try:
                data = f.read()
                if not data:
                    continue
                # pipeline wants something file-like
                obj = type("FileLike", (), {"filename": f.filename, "stream": io.BytesIO(data)})()
                obj.read = lambda d=data: d  # each file keeps its own bytes
                file_payloads.append(obj)
            except Exception:
                continue
        if file_payloads:
            brain_id_copy = brain_id
            user_id_copy = user.id
            uri = (current_app.config.get("SQLALCHEMY_DATABASE_URI") or "").lower()
            if "sqlite" in uri:
                # sqlite freaks out if two threads write - just do it here
                try:
                    from app.services.ingestion_pipeline import process_creation_files
                    process_creation_files(brain_id_copy, user_id_copy, file_payloads)
                except Exception:
                    db.session.rollback()
            else:
                app = current_app._get_current_object()

                def ingest_in_background():
                    with app.app_context():
                        try:
                            from app.services.ingestion_pipeline import process_creation_files
                            process_creation_files(brain_id_copy, user_id_copy, file_payloads)
                        except Exception:
                            pass

                threading.Thread(target=ingest_in_background, daemon=True).start()

    return jsonify({
        "brain": {
            "id": brain.id,
            "name": brain.name,
            "badge": brain.badge,
            "created_at": brain.created_at.isoformat() if brain.created_at else None,
        }
    }), 201


# upload more pdf/images into a class thats already there (thread does the hard part)
@bp.route("/brain/ingest", methods=["POST"])
@jwt_required()
def ingest():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    brain_id = request.form.get("brain_id")
    if not brain_id:
        return jsonify({"error": "brain_id required"}), 400

    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    files = request.files.getlist("files[]") or request.files.getlist("files")
    if not files:
        return jsonify({"error": "at least one file required"}), 400

    # Buffer bytes now — Flask won't let us read the stream after the response goes out
    import io
    file_payloads = []
    for f in files:
        if not f or not getattr(f, "filename", None):
            continue
        try:
            data = f.read()
            if not data:
                continue
            obj = type("FileLike", (), {"filename": f.filename, "stream": io.BytesIO(data)})()
            obj.read = lambda d=data: d
            file_payloads.append(obj)
        except Exception:
            continue

    if not file_payloads:
        return jsonify({"error": "no valid files to process"}), 400

    brain_id_copy = brain_id
    user_id_copy = user.id
    uri = (current_app.config.get("SQLALCHEMY_DATABASE_URI") or "").lower()

    if "sqlite" in uri:
        try:
            from app.services.ingestion_pipeline import ingest_documents

            result = ingest_documents(brain_id_copy, user_id_copy, file_payloads)
        except Exception as e:
            db.session.rollback()
            current_app.logger.exception("ingest_documents failed (sqlite)")
            return jsonify({"error": str(e), "processing": False}), 500

        return jsonify(
            {
                "processing": False,
                "files_count": len(file_payloads),
                "nodes_created": result.get("nodes_created", 0),
                "links_created": result.get("links_created", 0),
                "errors": result.get("errors", []),
            }
        ), 200

    app = current_app._get_current_object()

    def ingest_in_background():
        with app.app_context():
            try:
                from app.services.ingestion_pipeline import ingest_documents

                ingest_documents(brain_id_copy, user_id_copy, file_payloads)
            except Exception:
                db.session.rollback()
                current_app.logger.exception("ingest_documents failed (background)")

    threading.Thread(target=ingest_in_background, daemon=True).start()

    return jsonify({
        "message": "Processing started. Your document will appear in Sources when ready (may take a few minutes for large PDFs).",
        "processing": True,
        "files_count": len(file_payloads),
    }), 200


# scan/pic -> markdown for split view, maybe saves source row too
@bp.route("/brain/ocr", methods=["POST"])
@jwt_required()
def ocr():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    brain_id = request.form.get("brain_id")
    if not brain_id:
        return jsonify({"error": "brain_id required"}), 400

    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "file required"}), 400

    try:
        data = file.read()
        if not data:
            return jsonify({"error": "empty file"}), 400

        ext = os.path.splitext((file.filename or "").lower())[-1]
        allowed_img = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
        is_pdf = ext == ".pdf"
        source_file_id = None

        def _persist_scan(file_bytes: bytes, display_name: str, disk_ext: str, file_type: str):
            nonlocal source_file_id
            upload_root = _upload_root()
            brain_dir = upload_root / brain_id
            brain_dir.mkdir(parents=True, exist_ok=True)
            uid = str(uuid.uuid4())
            fname = f"{uid}{disk_ext}"
            full_path = brain_dir / fname
            full_path.write_bytes(file_bytes)
            rel = f"{brain_id}/{fname}"
            sf = SourceFile(
                brain_id=brain_id,
                filename=display_name,
                file_type=file_type,
                storage_path=rel,
            )
            db.session.add(sf)
            db.session.commit()
            source_file_id = sf.id

        if is_pdf:
            _persist_scan(data, file.filename or "scan.pdf", ".pdf", "pdf")
        elif ext in allowed_img:
            _persist_scan(data, file.filename or "scan.png", ext, "image")

        bio = BytesIO(data)
        bio.seek(0)
        fs = FileStorage(stream=bio, filename=file.filename or "upload.png")
        from app.services.ocr_service import run_ocr_to_markdown

        result = run_ocr_to_markdown(fs)
        result["source_file_id"] = source_file_id
        if source_file_id:
            result["preview_path"] = f"/api/brain/{brain_id}/sources/{source_file_id}/file"
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# send back the raw uploaded file if ur allowed to see that class
@bp.route("/brain/<brain_id>/sources/<int:source_id>/file", methods=["GET"])
@jwt_required()
def serve_source_file(brain_id, source_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    src = SourceFile.query.filter_by(id=source_id, brain_id=brain_id).first()
    if not src or not src.storage_path:
        return jsonify({"error": "file not found"}), 404
    path = _upload_root() / src.storage_path
    if not path.is_file():
        return jsonify({"error": "file missing on disk"}), 404
    guessed, _ = mimetypes.guess_type(str(path))
    if src.file_type == "pdf":
        mime = guessed or "application/pdf"
    elif src.file_type == "image":
        mime = guessed or "image/jpeg"
    else:
        mime = guessed or "application/octet-stream"
    return send_file(path, mimetype=mime, as_attachment=False, download_name=src.filename or "scan.png")


# chunk/pdf text -> vector + db nodes
@bp.route("/brain/generate-nodes", methods=["POST"])
@jwt_required()
def generate_nodes():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json() or {}
    brain_id = data.get("brain_id")
    if not brain_id:
        return jsonify({"error": "brain_id required"}), 400

    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    chunks = data.get("chunks")
    markdown = data.get("markdown")
    source_file_id = data.get("source_file_id")
    node_type = (data.get("node_type") or "").strip() or None

    if not chunks and not markdown:
        return jsonify({"error": "chunks or markdown required"}), 400

    try:
        from app.services.node_generation import generate_and_store_nodes
        result = generate_and_store_nodes(
            brain_id=brain_id,
            user_id=user.id,
            chunks=chunks,
            markdown=markdown,
            source_file_id=source_file_id,
            node_type=node_type,
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# sidebar list - yours + shared w u
@bp.route("/brain/list", methods=["GET"])
@jwt_required()
def list_brains():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    owned = Brain.query.filter_by(user_id=user.id).order_by(Brain.created_at.desc()).all()
    collab_ids = [
        r[0]
        for r in db.session.query(BrainCollaborator.brain_id)
        .filter(BrainCollaborator.user_id == user.id)
        .all()
    ]
    collab_brains = []
    if collab_ids:
        collab_brains = (
            Brain.query.filter(Brain.id.in_(collab_ids))
            .order_by(Brain.created_at.desc())
            .all()
        )
    seen = set()
    merged = []
    for b in owned:
        if b.id not in seen:
            seen.add(b.id)
            merged.append(b)
    for b in collab_brains:
        if b.id not in seen:
            seen.add(b.id)
            merged.append(b)

    return jsonify({
        "brains": [
            {
                "id": b.id,
                "name": b.name,
                "badge": b.badge,
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "is_owner": b.user_id == user.id,
            }
            for b in merged
        ]
    }), 200


# bail out of a shared class (owner has to delete not leave)
@bp.route("/brain/<brain_id>/leave", methods=["POST"])
@jwt_required()
def leave_brain(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = Brain.query.filter_by(id=brain_id).first()
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    if brain.user_id == user.id:
        return jsonify({"error": "owners should delete the brain instead of leaving"}), 400
    row = BrainCollaborator.query.filter_by(brain_id=brain_id, user_id=user.id).first()
    if not row:
        return jsonify({"error": "not a collaborator on this brain"}), 404
    db.session.delete(row)
    db.session.commit()
    return jsonify({"ok": True}), 200


# nuke everything for a class u own
@bp.route("/brain/<brain_id>", methods=["DELETE"])
@jwt_required()
def delete_brain(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = Brain.query.filter_by(id=brain_id).first()
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    if brain.user_id != user.id:
        return jsonify({"error": "only the brain owner can delete it"}), 403

    Node.query.filter_by(brain_id=brain_id).delete(synchronize_session=False)

    upload_root = _upload_root()
    for sf in SourceFile.query.filter_by(brain_id=brain_id).all():
        if sf.storage_path:
            fp = upload_root / sf.storage_path
            if fp.is_file():
                try:
                    fp.unlink()
                except OSError:
                    pass
    SourceFile.query.filter_by(brain_id=brain_id).delete(synchronize_session=False)

    brain_dir = upload_root / brain_id
    if brain_dir.is_dir():
        import shutil

        try:
            shutil.rmtree(brain_dir, ignore_errors=True)
        except Exception:
            pass

    BrainShareLink.query.filter_by(brain_id=brain_id).delete(synchronize_session=False)
    BrainCollaborator.query.filter_by(brain_id=brain_id).delete(synchronize_session=False)

    try:
        from app.services.pinecone_service import delete_brain_namespace

        delete_brain_namespace(brain_id)
    except Exception:
        pass

    db.session.delete(brain)
    db.session.commit()
    return jsonify({"ok": True, "id": brain_id}), 200


# make invite link token
@bp.route("/brain/<brain_id>/share-link", methods=["POST"])
@jwt_required()
def create_brain_share_link(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = Brain.query.filter_by(id=brain_id, user_id=user.id).first()
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    token = str(uuid.uuid4())
    link = BrainShareLink(token=token, brain_id=brain_id, created_by_user_id=user.id)
    db.session.add(link)
    db.session.commit()
    return jsonify({"token": token, "share_path": f"/shared/{token}"}), 201


# no login - shows class name on share page
@bp.route("/share/brain/<token>", methods=["GET"])
def public_share_brain_info(token):
    link = BrainShareLink.query.filter_by(token=token).first()
    if not link:
        return jsonify({"error": "not found"}), 404
    brain = Brain.query.get(link.brain_id)
    if not brain:
        return jsonify({"error": "not found"}), 404
    return jsonify({
        "brain": {
            "id": brain.id,
            "name": brain.name,
            "badge": brain.badge,
        }
    }), 200


# logged in user joins via token
@bp.route("/share/brain/<token>/join", methods=["POST"])
@jwt_required()
def join_shared_brain(token):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    link = BrainShareLink.query.filter_by(token=token).first()
    if not link:
        return jsonify({"error": "not found"}), 404
    brain = Brain.query.get(link.brain_id)
    if not brain:
        return jsonify({"error": "not found"}), 404
    if brain.user_id == user.id:
        return jsonify({"ok": True, "brain_id": brain.id, "role": "owner"}), 200
    if BrainCollaborator.query.filter_by(brain_id=brain.id, user_id=user.id).first():
        return jsonify({"ok": True, "brain_id": brain.id, "role": "collaborator"}), 200
    db.session.add(BrainCollaborator(brain_id=brain.id, user_id=user.id))
    db.session.commit()
    return jsonify({"ok": True, "brain_id": brain.id, "role": "collaborator"}), 200


# list uploaded files metadata
@bp.route("/brain/<brain_id>/sources", methods=["GET"])
@jwt_required()
def get_brain_sources(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    sources = SourceFile.query.filter_by(brain_id=brain_id).order_by(SourceFile.created_at.desc()).all()
    return jsonify({
        "sources": [
            {
                "id": s.id,
                "filename": s.filename,
                "file_type": s.file_type,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "has_file": bool(s.storage_path),
            }
            for s in sources
        ]
    }), 200


# delete uploaded file row (notes unlink)
@bp.route("/brain/<brain_id>/sources/<int:source_id>", methods=["DELETE"])
@jwt_required()
def delete_brain_source(brain_id, source_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    src = SourceFile.query.filter_by(id=source_id, brain_id=brain_id).first()
    if not src:
        return jsonify({"error": "source not found"}), 404
    Node.query.filter(Node.brain_id == brain_id, Node.source_file_id == source_id).update(
        {Node.source_file_id: None},
        synchronize_session=False,
    )
    CalendarEvent.query.filter(
        CalendarEvent.brain_id == brain_id,
        CalendarEvent.source_file_id == source_id,
    ).update({CalendarEvent.source_file_id: None}, synchronize_session=False)
    db.session.delete(src)
    db.session.commit()
    return jsonify({"ok": True}), 200


# syllabus pdf -> scrape due dates etc into calendar table
@bp.route("/brain/syllabus", methods=["POST"])
@jwt_required()
def upload_syllabus():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain_id = request.form.get("brain_id")
    if not brain_id:
        return jsonify({"error": "brain_id required"}), 400
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "file required"}), 400
    try:
        from app.services.syllabus_calendar import syllabus_text_from_file, extract_calendar_events

        data = file.read()
        if not data:
            return jsonify({"error": "empty file"}), 400
        text = syllabus_text_from_file(file.filename, data)
        if not text.strip():
            return jsonify({"error": "unable to extract text from syllabus"}), 400
        formatted_markdown = _syllabus_node_markdown(text)

        source_file = SourceFile(
            brain_id=brain_id,
            filename=file.filename,
            file_type="syllabus",
            storage_path=_persist_upload_bytes(brain_id, file.filename, data),
        )
        db.session.add(source_file)
        db.session.flush()

        # stash whole syllabus text as a fake note too so assistant can read it
        db.session.add(
            Node(
                id=str(uuid.uuid4()),
                brain_id=brain_id,
                source_file_id=source_file.id,
                title=f"Syllabus: {file.filename}",
                markdown_content=formatted_markdown[:200000],
                raw_content=text[:200000],
                node_type="syllabus",
                tags=["syllabus"],
            )
        )

        extracted = extract_calendar_events(text)
        saved = []
        for item in extracted:
            ev = CalendarEvent(
                brain_id=brain_id,
                source_file_id=source_file.id,
                title=item.get("title") or "Untitled event",
                event_type=(item.get("event_type") or "other").lower(),
                due_at=item.get("due_at"),
                course_label=item.get("course_label"),
                confidence=item.get("confidence"),
                notes=item.get("notes"),
            )
            db.session.add(ev)
            saved.append(ev)
        db.session.commit()
        return jsonify(
            {
                "source_file_id": source_file.id,
                "events": [_event_to_json(e) for e in saved],
                "count": len(saved),
            }
        ), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# home page grid - profiles + how many calendar things
@bp.route("/classes", methods=["GET"])
@jwt_required()
def list_classes():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    brains = Brain.query.filter_by(user_id=user.id).order_by(Brain.created_at.desc()).all()
    brain_ids = [b.id for b in brains]
    profiles = CourseProfile.query.filter(CourseProfile.brain_id.in_(brain_ids)).all() if brain_ids else []
    profile_map = {p.brain_id: p for p in profiles}

    count_map = {}
    if brain_ids:
        from sqlalchemy import func
        rows = (
            db.session.query(CalendarEvent.brain_id, func.count(CalendarEvent.id))
            .filter(CalendarEvent.brain_id.in_(brain_ids))
            .group_by(CalendarEvent.brain_id)
            .all()
        )
        count_map = {brain_id: count for brain_id, count in rows}

    classes = [_class_to_json(b, profile_map.get(b.id), count_map.get(b.id, 0)) for b in brains]
    return jsonify({"classes": classes}), 200


# type in class info yourself
@bp.route("/classes/manual", methods=["POST"])
@jwt_required()
def create_class_manual():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        class_number = (data.get("class_number") or "").strip()
        title = class_number or "New Class"

    brain = Brain(id=str(uuid.uuid4()), name=title[:255], badge="Class", user_id=user.id)
    db.session.add(brain)
    profile = _upsert_course_profile(brain.id, data)
    db.session.commit()

    return jsonify({"class": _class_to_json(brain, profile, 0)}), 201


# edit title / professor fields
@bp.route("/classes/<brain_id>", methods=["PUT"])
@jwt_required()
def update_class(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "class not found"}), 404

    data = request.get_json() or {}
    new_title = (data.get("title") or "").strip()
    if new_title:
        brain.name = new_title[:255]

    profile = _upsert_course_profile(brain.id, data)
    db.session.commit()

    event_count = CalendarEvent.query.filter_by(brain_id=brain.id).count()
    return jsonify({"class": _class_to_json(brain, profile, event_count)}), 200


# syllabus upload makes class + parses schedule
@bp.route("/classes/syllabus", methods=["POST"])
@jwt_required()
def create_class_from_syllabus():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "file required"}), 400

    try:
        from app.services.syllabus_calendar import syllabus_text_from_file, extract_calendar_events
        from app.services.syllabus_profile import extract_syllabus_profile

        data = file.read()
        if not data:
            return jsonify({"error": "empty file"}), 400
        text = syllabus_text_from_file(file.filename, data)
        if not text.strip():
            return jsonify({"error": "unable to extract text from syllabus"}), 400
        formatted_markdown = _syllabus_node_markdown(text)

        profile_data = extract_syllabus_profile(text)
        title = (
            profile_data.get("class_title")
            or profile_data.get("class_number")
            or Path(file.filename).stem
            or "New Class"
        )

        brain = Brain(id=str(uuid.uuid4()), name=title[:255], badge="Class", user_id=user.id)
        db.session.add(brain)
        profile = _upsert_course_profile(brain.id, profile_data)
        db.session.flush()

        source_file = SourceFile(
            brain_id=brain.id,
            filename=file.filename,
            file_type="syllabus",
            storage_path=_persist_upload_bytes(brain.id, file.filename, data),
        )
        db.session.add(source_file)
        db.session.flush()

        db.session.add(
            Node(
                id=str(uuid.uuid4()),
                brain_id=brain.id,
                source_file_id=source_file.id,
                title=f"Syllabus: {file.filename}",
                markdown_content=formatted_markdown[:200000],
                raw_content=text[:200000],
                node_type="syllabus",
                tags=["syllabus"],
            )
        )

        extracted = extract_calendar_events(text)
        saved = []
        fallback_course = profile.class_number or brain.name
        for item in extracted:
            ev = CalendarEvent(
                brain_id=brain.id,
                source_file_id=source_file.id,
                title=item.get("title") or "Untitled event",
                event_type=(item.get("event_type") or "other").lower(),
                due_at=item.get("due_at"),
                course_label=item.get("course_label") or fallback_course,
                confidence=item.get("confidence"),
                notes=item.get("notes"),
            )
            db.session.add(ev)
            saved.append(ev)

        db.session.commit()
        return jsonify(
            {
                "class": _class_to_json(brain, profile, len(saved)),
                "events": [_event_to_json(e) for e in saved],
                "count": len(saved),
            }
        ), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# json for the preview cards when u pick a class
@bp.route("/classes/<brain_id>/syllabus-preview", methods=["GET"])
@jwt_required()
def class_syllabus_preview(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "class not found"}), 404

    node = (
        Node.query.filter_by(brain_id=brain_id, node_type="syllabus")
        .order_by(Node.created_at.desc())
        .first()
    )
    if not node:
        return jsonify({"sections": [], "has_syllabus": False}), 200

    text = (node.markdown_content or node.raw_content or "").strip()
    sections = _extract_syllabus_sections(text)

    source = SourceFile.query.filter_by(id=node.source_file_id, brain_id=brain_id).first() if node.source_file_id else None
    file_path = f"/api/brain/{brain_id}/sources/{source.id}/file" if source and source.storage_path else None

    return jsonify(
        {
            "has_syllabus": True,
            "source": {
                "id": source.id if source else None,
                "filename": source.filename if source else None,
                "file_path": file_path,
            },
            "sections": sections,
        }
    ), 200


# planner bot sees all ur classes at once
@bp.route("/classes/assistant", methods=["POST"])
@jwt_required()
def classes_assistant():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return jsonify({"error": "prompt required"}), 400

    brains = Brain.query.filter_by(user_id=user.id).all()
    brain_ids = [b.id for b in brains]
    if not brain_ids:
        return jsonify({"response": "No classes yet. Add one manually or upload a syllabus first."}), 200

    now_utc = datetime.now(timezone.utc)
    window_end = now_utc + timedelta(days=14)
    events = (
        CalendarEvent.query.filter(CalendarEvent.brain_id.in_(brain_ids))
        .filter(CalendarEvent.due_at >= now_utc - timedelta(days=7))
        .filter(CalendarEvent.due_at <= window_end)
        .order_by(CalendarEvent.due_at.asc())
        .all()
    )
    profiles = CourseProfile.query.filter(CourseProfile.brain_id.in_(brain_ids)).all()
    profile_map = {p.brain_id: p for p in profiles}
    brain_map = {b.id: b for b in brains}

    event_lines = []
    for e in events:
        b = brain_map.get(e.brain_id)
        p = profile_map.get(e.brain_id)
        course = (p.class_number if p else None) or (b.name if b else e.course_label) or "Unknown class"
        event_lines.append(f"- {course}: [{e.event_type}] {e.title} on {e.due_at.isoformat()}")
    profile_lines = []
    for b in brains:
        p = profile_map.get(b.id)
        if not p:
            continue
        profile_lines.append(
            f"- {b.name}: professor={p.professor or 'n/a'}, section={p.section or 'n/a'}, "
            f"meets={p.meeting_days or 'n/a'} {p.meeting_time or ''}, room={p.classroom or 'n/a'}, office_hours={p.office_hours or 'n/a'}"
        )

    # paste syllabus blobs in too
    syllabus_nodes = (
        Node.query.filter(Node.brain_id.in_(brain_ids))
        .filter(Node.node_type == "syllabus")
        .order_by(Node.created_at.desc())
        .limit(30)
        .all()
    )
    syllabus_lines = []
    for n in syllabus_nodes:
        b = brain_map.get(n.brain_id)
        course = b.name if b else n.brain_id
        text = (n.markdown_content or n.raw_content or "").strip()
        if text:
            syllabus_lines.append(f"### {course}\n{text[:6000]}")

    notes_section = _classes_assistant_notes_section(brain_map, brain_ids)

    context = (
        _datetime_anchor_block(now_utc)
        + "## Classes\n"
        + ("\n".join(profile_lines) if profile_lines else "No class metadata.")
        + "\n\n## Upcoming Events\n"
        + ("\n".join(event_lines) if event_lines else "No upcoming events in the next 2 weeks.")
        + "\n\n## Your notes (recent across classes)\n"
        + notes_section
        + "\n\n## Syllabus Content\n"
        + ("\n\n---\n\n".join(syllabus_lines) if syllabus_lines else "No syllabus text available.")
    )
    try:
        from app.services.openai_service import ask_brain as llm_ask_brain
        response_text = llm_ask_brain(
            context,
            (
                "You are a class planning assistant. Answer using class metadata, calendar events, "
                "the user's recent notes from all classes, and syllabus text when relevant. "
                "The context may begin with an INTERNAL_REFERENCE datetime block: use it only for reasoning about "
                '"today" or relative dates — never paste, echo, or open your answer with that block or a duplicate "today\'s date" section. '
                "If asked about this week/next week, group events by calendar week in the reference timezone. "
                f"User question: {prompt}"
            ),
            "custom",
        )
        return jsonify({"response": response_text}), 200
    except Exception:
        low = prompt.lower()
        if "quiz" in low or "test" in low or "exam" in low:
            filtered = [e for e in events if e.event_type in {"quiz", "test", "midterm", "final"}]
        else:
            filtered = events
        if not filtered:
            return jsonify({"response": "I could not find matching upcoming events in your class calendars."}), 200
        lines = []
        for e in filtered[:20]:
            b = brain_map.get(e.brain_id)
            p = profile_map.get(e.brain_id)
            course = (p.class_number if p else None) or (b.name if b else e.course_label) or "Unknown class"
            lines.append(f"- {course}: [{e.event_type}] {e.title} on {e.due_at.strftime('%a %b %d, %Y %I:%M %p')}")
        return jsonify({"response": "Here are your upcoming items:\n" + "\n".join(lines)}), 200


# calendar events for ONE class + filters
@bp.route("/brain/<brain_id>/calendar-events", methods=["GET"])
@jwt_required()
def get_brain_calendar_events(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    start = _parse_datetime_value(request.args.get("start"))
    end = _parse_datetime_value(request.args.get("end"))
    event_type = (request.args.get("type") or "").strip().lower()

    q = CalendarEvent.query.filter_by(brain_id=brain_id)
    if start:
        q = q.filter(CalendarEvent.due_at >= start)
    if end:
        q = q.filter(CalendarEvent.due_at <= end)
    if event_type:
        q = q.filter(CalendarEvent.event_type == event_type)
    events = q.order_by(CalendarEvent.due_at.asc()).all()
    return jsonify({"events": [_event_to_json(e) for e in events]}), 200


# user typed a due date row
@bp.route("/brain/<brain_id>/calendar-events", methods=["POST"])
@jwt_required()
def create_brain_calendar_event(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()[:512]
    if not title:
        return jsonify({"error": "title required"}), 400
    due_at = _parse_datetime_value(data.get("due_at"))
    if not due_at:
        return jsonify({"error": "valid due_at required"}), 400
    event_type = (data.get("event_type") or "other").strip().lower()
    if event_type not in {"quiz", "midterm", "test", "project", "assignment", "final", "other"}:
        event_type = "other"
    ev = CalendarEvent(
        brain_id=brain_id,
        title=title,
        event_type=event_type,
        due_at=due_at,
        course_label=(data.get("course_label") or "").strip()[:128] or None,
        confidence=data.get("confidence"),
        notes=(data.get("notes") or "").strip() or None,
    )
    db.session.add(ev)
    db.session.commit()
    return jsonify(_event_to_json(ev)), 201


# edit due date row
@bp.route("/brain/<brain_id>/calendar-events/<int:event_id>", methods=["PUT"])
@jwt_required()
def update_brain_calendar_event(brain_id, event_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    ev = CalendarEvent.query.filter_by(id=event_id, brain_id=brain_id).first()
    if not ev:
        return jsonify({"error": "event not found"}), 404
    data = request.get_json() or {}
    if "title" in data:
        title = (data.get("title") or "").strip()[:512]
        if not title:
            return jsonify({"error": "title cannot be empty"}), 400
        ev.title = title
    if "event_type" in data:
        event_type = (data.get("event_type") or "other").strip().lower()
        if event_type not in {"quiz", "midterm", "test", "project", "assignment", "final", "other"}:
            event_type = "other"
        ev.event_type = event_type
    if "due_at" in data:
        due_at = _parse_datetime_value(data.get("due_at"))
        if not due_at:
            return jsonify({"error": "valid due_at required"}), 400
        ev.due_at = due_at
    if "course_label" in data:
        ev.course_label = (data.get("course_label") or "").strip()[:128] or None
    if "confidence" in data:
        conf = data.get("confidence")
        try:
            ev.confidence = float(conf) if conf is not None else None
        except Exception:
            ev.confidence = None
    if "notes" in data:
        ev.notes = (data.get("notes") or "").strip() or None
    ev.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(_event_to_json(ev)), 200


# delete assignment row
@bp.route("/brain/<brain_id>/calendar-events/<int:event_id>", methods=["DELETE"])
@jwt_required()
def delete_brain_calendar_event(brain_id, event_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    ev = CalendarEvent.query.filter_by(id=event_id, brain_id=brain_id).first()
    if not ev:
        return jsonify({"error": "event not found"}), 404
    db.session.delete(ev)
    db.session.commit()
    return jsonify({"ok": True, "id": event_id}), 200


# merged calendar - owned + shared classes
@bp.route("/calendar-events", methods=["GET"])
@jwt_required()
def get_global_calendar_events():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    owned = Brain.query.filter_by(user_id=user.id).all()
    collab_ids = [r[0] for r in db.session.query(BrainCollaborator.brain_id).filter_by(user_id=user.id).all()]
    brain_ids = list({*(b.id for b in owned), *collab_ids})
    if not brain_ids:
        return jsonify({"events": []}), 200

    start = _parse_datetime_value(request.args.get("start"))
    end = _parse_datetime_value(request.args.get("end"))
    event_type = (request.args.get("type") or "").strip().lower()
    brain_name_map = {b.id: b.name for b in Brain.query.filter(Brain.id.in_(brain_ids)).all()}

    q = CalendarEvent.query.filter(CalendarEvent.brain_id.in_(brain_ids))
    if start:
        q = q.filter(CalendarEvent.due_at >= start)
    if end:
        q = q.filter(CalendarEvent.due_at <= end)
    if event_type:
        q = q.filter(CalendarEvent.event_type == event_type)
    rows = q.order_by(CalendarEvent.due_at.asc()).all()
    return jsonify(
        {
            "events": [
                {
                    **_event_to_json(e),
                    "brain_name": brain_name_map.get(e.brain_id, ""),
                }
                for e in rows
            ]
        }
    ), 200


# chat w ur notes for one class (modes like summary etc)
@bp.route("/brain/<brain_id>/ask", methods=["POST"])
@jwt_required()
def ask_brain_route(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    mode = (data.get("mode") or "summary").strip().lower()
    time_scope = (data.get("time_scope") or "").strip().lower()
    response_intent = (data.get("response_intent") or "").strip().lower()
    try:
        upcoming_days = max(1, min(90, int(data.get("upcoming_days") or 21)))
    except Exception:
        upcoming_days = 21
    if mode not in ("summary", "study_guide", "key_points", "custom"):
        mode = "custom"

    nodes_query = Node.query.filter_by(brain_id=brain_id)
    if time_scope == "last_2_weeks":
        since = datetime.now(timezone.utc) - timedelta(days=14)
        nodes_query = nodes_query.filter(
            (Node.updated_at >= since) | (Node.created_at >= since)
        )
    nodes = (
        nodes_query.order_by(Node.updated_at.desc().nullslast(), Node.created_at.desc())
        .limit(100)
        .all()
    )
    context_parts = []
    for n in nodes:
        content = n.markdown_content or n.raw_content or ""
        if content.strip():
            title = (n.title or "Untitled").strip()
            context_parts.append(f"## {title}\n\n{content[:8000]}")
    context_text = "\n\n---\n\n".join(context_parts) if context_parts else ""

    event_query = CalendarEvent.query.filter_by(brain_id=brain_id)
    now_utc = datetime.now(timezone.utc)
    if response_intent == "study_for_upcoming":
        event_query = event_query.filter(CalendarEvent.due_at >= now_utc)
        event_query = event_query.filter(CalendarEvent.due_at <= now_utc + timedelta(days=upcoming_days))
    elif time_scope == "last_2_weeks":
        event_query = event_query.filter(CalendarEvent.due_at >= now_utc - timedelta(days=14))
        event_query = event_query.filter(CalendarEvent.due_at <= now_utc)
    events = event_query.order_by(CalendarEvent.due_at.asc()).limit(60).all()
    event_lines = []
    for e in events:
        when = e.due_at.isoformat() if e.due_at else "unknown"
        event_lines.append(
            f"- [{e.event_type}] {e.title} @ {when}"
            + (f" ({e.course_label})" if e.course_label else "")
        )
    event_context = "\n".join(event_lines)

    if not context_text.strip() and not event_context.strip():
        return jsonify({"response": "Add some notes or upload documents to this brain first, then ask for a summary or study guide."}), 200

    try:
        from app.services.openai_service import ask_brain as llm_ask_brain
        anchor = _datetime_anchor_block(now_utc)
        full_context = context_text
        if event_context.strip():
            full_context = (
                f"{context_text}\n\n---\n\n## Calendar Events\n\n{event_context}"
                if context_text.strip()
                else f"## Calendar Events\n\n{event_context}"
            )
        full_context = f"{anchor}\n{full_context}".strip()
        if response_intent == "study_for_upcoming" and not prompt:
            prompt = "Help me study for my upcoming assessments based on the notes and calendar."
        elif time_scope == "last_2_weeks" and not prompt:
            prompt = "Summarize my notes and key deadlines from the last two weeks."
        response_text = llm_ask_brain(full_context, prompt or "Summarize the above.", mode)
        return jsonify({"response": response_text}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ctrl+k search bar thing
@bp.route("/brain/search", methods=["GET"])
@jwt_required()
def search():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"results": []}), 200

    search_term = f"%{q}%"
    brains = Brain.query.filter_by(user_id=user.id).all()
    brain_ids = [b.id for b in brains]
    if not brain_ids:
        return jsonify({"results": []}), 200

    from sqlalchemy import or_
    nodes = (
        Node.query.filter(Node.brain_id.in_(brain_ids))
        .filter(
            or_(
                Node.title.ilike(search_term),
                Node.summary.ilike(search_term),
                Node.raw_content.ilike(search_term),
            )
        )
        .limit(50)
        .all()
    )
    brain_map = {b.id: b.name for b in brains}
    return jsonify({
        "results": [
            {
                "id": n.id,
                "title": n.title,
                "summary": (n.summary or "")[:300],
                "brain_id": n.brain_id,
                "brain_name": brain_map.get(n.brain_id, ""),
            }
            for n in nodes
        ]
    }), 200


# sidebar note list w paging
@bp.route("/brain/<brain_id>/nodes", methods=["GET"])
@jwt_required()
def get_brain_nodes(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    from sqlalchemy import or_
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, max(1, int(request.args.get("per_page", 50))))
    q = (request.args.get("q") or "").strip()
    tag = (request.args.get("tag") or "").strip()
    sort = (request.args.get("sort") or "recent").lower()

    query = Node.query.filter_by(brain_id=brain_id)
    if q:
        term = f"%{q}%"
        query = query.filter(
            or_(
                Node.title.ilike(term),
                Node.markdown_content.ilike(term),
                Node.raw_content.ilike(term),
            )
        )
    if tag:
        query = query.filter(Node.tags.contains([tag]))
    if sort == "alpha":
        query = query.order_by(Node.title.asc())
    else:
        query = query.order_by(Node.updated_at.desc().nullslast(), Node.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page)
    nodes = pagination.items
    return jsonify({
        "nodes": [
            _node_to_json(n)
            for n in nodes
        ],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
    }), 200


# blank note POST
@bp.route("/brain/<brain_id>/nodes", methods=["POST"])
@jwt_required()
def create_node(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    data = request.get_json() or {}
    title = (data.get("title") or "Untitled").strip()[:512] or "Untitled"
    markdown_content = data.get("markdown_content")
    if markdown_content is None:
        markdown_content = "# Untitled\n\nStart writing here. Handwritten scans open with the image on the left and Markdown on the right."
    tags = data.get("tags")
    if not isinstance(tags, list):
        tags = []
    node_type = (data.get("node_type") or "note").strip() or "note"

    node_id = str(uuid.uuid4())
    node = Node(
        id=node_id,
        brain_id=brain_id,
        title=title,
        markdown_content=markdown_content,
        tags=[str(t).strip() for t in tags if t],
        node_type=node_type,
    )
    db.session.add(node)
    db.session.commit()
    return jsonify(_node_to_json(node)), 201


def _node_to_json(n):
    content = n.markdown_content if n.markdown_content is not None else n.raw_content
    return {
        "id": n.id,
        "brain_id": n.brain_id,
        "source_file_id": getattr(n, "source_file_id", None),
        "title": n.title,
        "markdown_content": content or "",
        "tags": n.tags if n.tags is not None else (n.concepts or []),
        "node_type": getattr(n, "node_type", None) or "note",
        "summary": n.summary,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


def _node_for_user(node_id, user_id):
    node = Node.query.get(node_id)
    if not node:
        return None
    brain = _brain_for_user(node.brain_id, user_id)
    return node if brain else None


# load single note by id
@bp.route("/nodes/<node_id>", methods=["GET"])
@jwt_required()
def get_node(node_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    node = _node_for_user(node_id, user.id)
    if not node:
        return jsonify({"error": "node not found"}), 404
    return jsonify(_node_to_json(node)), 200


# autosave / save markdown
@bp.route("/nodes/<node_id>", methods=["PUT"])
@jwt_required()
def update_node(node_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    node = _node_for_user(node_id, user.id)
    if not node:
        return jsonify({"error": "node not found"}), 404

    data = request.get_json() or {}
    if "title" in data and data["title"] is not None:
        node.title = (data["title"] or "").strip()[:512] or node.title
    if "markdown_content" in data:
        node.markdown_content = data["markdown_content"] if data["markdown_content"] is not None else None
    if "tags" in data and isinstance(data["tags"], list):
        node.tags = [str(t).strip() for t in data["tags"] if t]
    try:
        node.updated_at = datetime.now(timezone.utc)
    except Exception:
        pass
    db.session.commit()
    db.session.refresh(node)
    return jsonify(_node_to_json(node)), 200


# trash note + try delete old pinecone junk
@bp.route("/nodes/<node_id>", methods=["DELETE"])
@jwt_required()
def delete_node(node_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    node = _node_for_user(node_id, user.id)
    if not node:
        return jsonify({"error": "node not found"}), 404

    brain_id = node.brain_id

    try:
        from app.services.pinecone_service import delete_vectors

        vid = node.embedding_id or node.id
        delete_vectors(brain_id, [str(vid)])
    except Exception:
        pass

    db.session.delete(node)
    db.session.commit()
    return jsonify({"ok": True, "id": node_id, "brain_id": brain_id}), 200

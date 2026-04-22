import re
from typing import Optional

from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.user import User
from sqlalchemy import or_

from app.models.brain import Brain, BrainCollaborator, Node

bp = Blueprint("home", __name__)

# Don't count onboarding / system nodes toward “how many notes”
NOTE_TYPES = ("note", "handwritten", "textbook_section")


def _display_name_from_email(email: Optional[str]) -> str:
    if not email or "@" not in email:
        return "there"
    local = email.split("@", 1)[0].strip()
    local = re.sub(r"[._\-+]+", " ", local)
    parts = [p for p in local.split() if p]
    if not parts:
        return "there"

    def cap(word: str) -> str:
        return word[0].upper() + word[1:].lower() if len(word) > 1 else word.upper()

    return " ".join(cap(p) for p in parts)


@bp.route("/home", methods=["GET"])
@jwt_required()
def home():
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        pass
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404
    return jsonify({"message": f"Welcome {user.email}"})


@bp.route("/me/summary", methods=["GET"])
@jwt_required()
def me_summary():
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        pass
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404
    owned = Brain.query.filter_by(user_id=user.id).all()
    collab_ids = [r.brain_id for r in BrainCollaborator.query.filter_by(user_id=user.id).all()]
    brain_ids = list({*(b.id for b in owned), *collab_ids})
    brains_count = len(brain_ids)
    if brain_ids:
        total_notes = Node.query.filter(
            Node.brain_id.in_(brain_ids),
            or_(Node.node_type.in_(NOTE_TYPES), Node.node_type.is_(None)),
        ).count()
    else:
        total_notes = 0
    return jsonify({
        "email": user.email,
        "display_name": _display_name_from_email(user.email),
        "total_notes": total_notes,
        "brains_count": brains_count,
    }), 200


@bp.route("/audio/tts", methods=["POST"])
@jwt_required()
def audio_tts():
    """Text-to-speech via OpenAI Audio API (same OPENAI_API_KEY as chat). Returns audio/mpeg."""
    data = request.get_json() or {}
    text = (data.get("text") or "").strip()
    voice = (data.get("voice") or "alloy").strip()
    if not text:
        return jsonify({"error": "text required"}), 400
    try:
        from app.services.openai_service import synthesize_speech_mp3

        mp3 = synthesize_speech_mp3(text, voice=voice)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": f"TTS failed: {e!s}"}), 500
    return Response(mp3, mimetype="audio/mpeg", headers={"Cache-Control": "no-store"})


@bp.route("/audio/transcribe", methods=["POST"])
@jwt_required()
def audio_transcribe():
    """Speech-to-text via OpenAI Whisper (multipart file field `file`)."""
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"error": "file required"}), 400
    raw = f.read()
    if len(raw) > 15 * 1024 * 1024:
        return jsonify({"error": "file too large (max 15 MB)"}), 400
    name = (f.filename or "recording.webm").lower()
    if not any(name.endswith(ext) for ext in (".webm", ".wav", ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".ogg", ".oga", ".flac")):
        # Whisper accepts many types; allow unknown extension if non-empty body
        if not raw:
            return jsonify({"error": "empty file"}), 400
    try:
        from app.services.openai_service import transcribe_audio_bytes

        text = transcribe_audio_bytes(raw, filename=f.filename or "recording.webm")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": f"Transcription failed: {e!s}"}), 500
    return jsonify({"text": text}), 200


@bp.route("/me/activity", methods=["GET"])
@jwt_required()
def me_activity():
    """Latest edits across brains you can access — little activity strip on home."""
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        pass
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    limit = min(20, max(1, int(request.args.get("limit", 8))))
    owned = Brain.query.filter_by(user_id=user.id).all()
    collab_ids = [r.brain_id for r in BrainCollaborator.query.filter_by(user_id=user.id).all()]
    collab_brains = Brain.query.filter(Brain.id.in_(collab_ids)).all() if collab_ids else []
    brain_map = {b.id: b.name for b in owned}
    for b in collab_brains:
        brain_map.setdefault(b.id, b.name)
    if not brain_map:
        return jsonify({"items": []}), 200

    accessible_ids = list(brain_map.keys())
    q = (
        Node.query.filter(Node.brain_id.in_(accessible_ids))
        .filter(or_(Node.node_type.in_(NOTE_TYPES), Node.node_type.is_(None)))
    )
    rows = (
        q.order_by(Node.updated_at.desc().nullslast(), Node.created_at.desc())
        .limit(limit)
        .all()
    )
    items = []
    for n in rows:
        items.append({
            "id": n.id,
            "title": n.title or "Untitled",
            "brain_id": n.brain_id,
            "brain_name": brain_map.get(n.brain_id, ""),
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "kind": "note",
        })
    return jsonify({"items": items}), 200


@bp.route("/me/notes", methods=["GET"])
@jwt_required()
def me_notes():
    """All-notes gallery with paging + search."""
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        pass
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, max(1, int(request.args.get("per_page", 48))))
    q = (request.args.get("q") or "").strip()

    owned = Brain.query.filter_by(user_id=user.id).all()
    collab_ids = [r.brain_id for r in BrainCollaborator.query.filter_by(user_id=user.id).all()]
    collab_brains = Brain.query.filter(Brain.id.in_(collab_ids)).all() if collab_ids else []

    brain_map = {b.id: b.name for b in owned}
    for b in collab_brains:
        brain_map.setdefault(b.id, b.name)

    if not brain_map:
        return jsonify({"nodes": [], "total": 0, "page": page, "per_page": per_page}), 200

    accessible_ids = list(brain_map.keys())

    base = (
        Node.query.filter(Node.brain_id.in_(accessible_ids))
        .filter(or_(Node.node_type.in_(NOTE_TYPES), Node.node_type.is_(None)))
    )
    if q:
        like = f"%{q}%"
        base = base.filter(or_(Node.title.ilike(like), Node.markdown_content.ilike(like)))

    total = base.count()
    rows = (
        base.order_by(Node.updated_at.desc().nullslast(), Node.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    nodes_out = []
    for n in rows:
        nodes_out.append({
            "id": n.id,
            "brain_id": n.brain_id,
            "brain_name": brain_map.get(n.brain_id, ""),
            "title": n.title or "Untitled",
            "summary": (n.summary or "")[:400],
            "markdown_content": (n.markdown_content or "")[:500],
            "node_type": n.node_type or "note",
            "source_file_id": n.source_file_id,
            "tags": n.tags or [],
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })

    return jsonify({
        "nodes": nodes_out,
        "total": total or 0,
        "page": page,
        "per_page": per_page,
    }), 200

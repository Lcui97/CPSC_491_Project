"""ORM models for workspaces (brains), uploaded files, notes, sharing, and calendar rows."""
from app.extensions import db


class Brain(db.Model):
    __tablename__ = "brains"

    id = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    badge = db.Column(db.String(32), nullable=False, default="Notes")  # UI label flavour
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    seed_nodes_created = db.Column(db.Boolean, nullable=False, default=False)  # welcome notes already inserted
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    user = db.relationship("User", backref=db.backref("brains", lazy="dynamic"))
    nodes = db.relationship("Node", backref="brain", lazy="dynamic", cascade="all, delete-orphan")
    source_files = db.relationship("SourceFile", backref="brain", lazy="dynamic", cascade="all, delete-orphan")
    calendar_events = db.relationship("CalendarEvent", backref="brain", lazy="dynamic", cascade="all, delete-orphan")
    class_profile = db.relationship("CourseProfile", backref="brain", uselist=False, cascade="all, delete-orphan")


class SourceFile(db.Model):
    """Something the user uploaded against a brain (PDF, scan, etc.)."""
    __tablename__ = "source_files"

    id = db.Column(db.Integer, primary_key=True)
    brain_id = db.Column(db.String(64), db.ForeignKey("brains.id"), nullable=False, index=True)
    filename = db.Column(db.String(512), nullable=False)
    file_type = db.Column(db.String(32), nullable=False)  # pdf, image, text, …
    storage_path = db.Column(db.String(1024), nullable=True)  # relative path under uploads/, if any
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    nodes = db.relationship("Node", backref="source_file", lazy="dynamic", foreign_keys="Node.source_file_id")
    calendar_events = db.relationship(
        "CalendarEvent",
        backref="source_file",
        lazy="dynamic",
        foreign_keys="CalendarEvent.source_file_id",
        cascade="all, delete-orphan",
    )


class CalendarEvent(db.Model):
    """Due date row — from syllabus import or typed in by the user."""
    __tablename__ = "calendar_events"

    id = db.Column(db.Integer, primary_key=True)
    brain_id = db.Column(db.String(64), db.ForeignKey("brains.id"), nullable=False, index=True)
    source_file_id = db.Column(db.Integer, db.ForeignKey("source_files.id"), nullable=True, index=True)
    title = db.Column(db.String(512), nullable=False)
    event_type = db.Column(db.String(32), nullable=False, default="other")  # quiz, midterm, …
    due_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    course_label = db.Column(db.String(128), nullable=True)
    confidence = db.Column(db.Float, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now())


class CourseProfile(db.Model):
    """Canvas-like class metadata extracted from syllabus or entered manually."""
    __tablename__ = "course_profiles"

    id = db.Column(db.Integer, primary_key=True)
    brain_id = db.Column(db.String(64), db.ForeignKey("brains.id"), nullable=False, unique=True, index=True)
    professor = db.Column(db.String(255), nullable=True)
    class_number = db.Column(db.String(64), nullable=True)
    section = db.Column(db.String(64), nullable=True)
    meeting_days = db.Column(db.String(128), nullable=True)
    meeting_time = db.Column(db.String(128), nullable=True)
    classroom = db.Column(db.String(128), nullable=True)
    office_hours = db.Column(db.String(255), nullable=True)
    term = db.Column(db.String(128), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now())


class Node(db.Model):
    """A note or an auto-generated chunk from a textbook — title, markdown body, tags."""
    __tablename__ = "nodes"

    id = db.Column(db.String(64), primary_key=True)
    brain_id = db.Column(db.String(64), db.ForeignKey("brains.id"), nullable=False, index=True)
    source_file_id = db.Column(db.Integer, db.ForeignKey("source_files.id"), nullable=True, index=True)

    title = db.Column(db.String(512), nullable=False)
    summary = db.Column(db.Text, nullable=True)
    raw_content = db.Column(db.Text, nullable=True)  # older pipeline text
    markdown_content = db.Column(db.Text, nullable=True)  # what the editor shows
    concepts = db.Column(db.JSON, nullable=True)
    section_title = db.Column(db.String(512), nullable=True)
    tags = db.Column(db.JSON, nullable=True)
    node_type = db.Column(db.String(32), nullable=True, default="note")  # note, handwritten, seed, …
    embedding_id = db.Column(db.String(256), nullable=True, index=True)
    metadata_json = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now())
    related_node_ids = db.Column(db.JSON, nullable=True)  # legacy; unused


class BrainShareLink(db.Model):
    """Random token the owner hands out so others can join."""
    __tablename__ = "brain_share_links"

    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    brain_id = db.Column(db.String(64), db.ForeignKey("brains.id"), nullable=False, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())


class BrainCollaborator(db.Model):
    """Someone who joined via invite — not the owner."""
    __tablename__ = "brain_collaborators"

    id = db.Column(db.Integer, primary_key=True)
    brain_id = db.Column(db.String(64), db.ForeignKey("brains.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    __table_args__ = (db.UniqueConstraint("brain_id", "user_id", name="uq_brain_collaborator"),)

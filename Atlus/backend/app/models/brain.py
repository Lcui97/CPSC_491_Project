"""
Brain and Node models for the knowledge graph.
- Brain: container for a user's knowledge graph (name, owner, source files).
- Node: knowledge node with title, summary, concepts, relationships, embeddings.
"""
from app.extensions import db


class Brain(db.Model):
    __tablename__ = "brains"

    id = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    badge = db.Column(db.String(32), nullable=False, default="Notes")  # Notes | Textbook | Compare
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    seed_nodes_created = db.Column(db.Boolean, nullable=False, default=False)  # idempotent seed
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    user = db.relationship("User", backref=db.backref("brains", lazy="dynamic"))
    nodes = db.relationship("Node", backref="brain", lazy="dynamic", cascade="all, delete-orphan")
    source_files = db.relationship("SourceFile", backref="brain", lazy="dynamic", cascade="all, delete-orphan")


class SourceFile(db.Model):
    """Reference to an ingested file (PDF, image, etc.) for a Brain."""
    __tablename__ = "source_files"

    id = db.Column(db.Integer, primary_key=True)
    brain_id = db.Column(db.String(64), db.ForeignKey("brains.id"), nullable=False, index=True)
    filename = db.Column(db.String(512), nullable=False)
    file_type = db.Column(db.String(32), nullable=False)  # pdf | image | text | markdown
    storage_path = db.Column(db.String(1024), nullable=True)  # optional path if stored on disk/S3
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    nodes = db.relationship("Node", backref="source_file", lazy="dynamic", foreign_keys="Node.source_file_id")


class Node(db.Model):
    """
    Knowledge graph node: note or extracted chunk. Obsidian-style: title, markdown_content, tags.
    """
    __tablename__ = "nodes"

    id = db.Column(db.String(64), primary_key=True)
    brain_id = db.Column(db.String(64), db.ForeignKey("brains.id"), nullable=False, index=True)
    source_file_id = db.Column(db.Integer, db.ForeignKey("source_files.id"), nullable=True, index=True)

    title = db.Column(db.String(512), nullable=False)
    summary = db.Column(db.Text, nullable=True)
    raw_content = db.Column(db.Text, nullable=True)  # legacy / original chunk
    markdown_content = db.Column(db.Text, nullable=True)  # primary note content (Markdown)
    concepts = db.Column(db.JSON, nullable=True)
    section_title = db.Column(db.String(512), nullable=True)
    tags = db.Column(db.JSON, nullable=True)  # ["tag1", "tag2"]
    node_type = db.Column(db.String(32), nullable=True, default="note")  # note | handwritten | textbook_section | seed
    embedding_id = db.Column(db.String(256), nullable=True, index=True)
    metadata_json = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())
    updated_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), onupdate=db.func.now())
    related_node_ids = db.Column(db.JSON, nullable=True)


class NodeRelationship(db.Model):
    """Graph edge: source -> target with type and optional weight."""
    __tablename__ = "node_relationships"

    id = db.Column(db.Integer, primary_key=True)
    source_node_id = db.Column(db.String(64), db.ForeignKey("nodes.id"), nullable=False, index=True)
    target_node_id = db.Column(db.String(64), db.ForeignKey("nodes.id"), nullable=False, index=True)
    edge_type = db.Column(db.String(64), nullable=True)  # e.g. "references", "similar"
    weight = db.Column(db.Float, nullable=True)  # optional strength
    similarity_score = db.Column(db.Float, nullable=True)  # legacy
    created_at = db.Column(db.DateTime(timezone=True), server_default=db.func.now())

    source_node = db.relationship("Node", foreign_keys=[source_node_id])
    target_node = db.relationship("Node", foreign_keys=[target_node_id])

    __table_args__ = (
        db.UniqueConstraint("source_node_id", "target_node_id", name="uq_node_relationship"),
    )

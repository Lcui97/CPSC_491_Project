"""
Idempotent seed example notes for a new Brain. Creates 2-3 markdown nodes if not already present.
"""
import uuid
from app.extensions import db
from app.models.brain import Brain, Node

SEED_TITLES = [
    "Welcome to your Brain",
    "How to use Notes + Graph",
    "Example links and tags",
]

SEED_CONTENT = [
    """# Welcome to your Brain

This is your first note. You can write in **Markdown** and link ideas across notes.

- Use the **Graph** tab to see how notes connect.
- Add new notes with **+ New Note**.
- Search and filter in the sidebar.""",
    """# How to use Notes + Graph

## Notes
- Edit in the center panel; use **Edit** / **Preview** / **Split**.
- Backlinks and related notes appear on the right.

## Graph
- Click a node to open its note.
- Filter by tag or use "Local graph" to focus one note and its neighbors.""",
    """# Example links and tags

Add `tags` to notes (e.g. `#concept`, `#todo`) and filter by them in the sidebar.

You can reference other notes by title; the graph will show relationships as you add more content.""",
]


def ensure_seed_nodes(brain_id: str) -> int:
    """
    Create seed nodes for the brain if not already created. Idempotent.
    Returns number of nodes created (0 if already seeded).
    """
    brain = Brain.query.get(brain_id)
    if not brain or getattr(brain, "seed_nodes_created", False):
        return 0
    existing = Node.query.filter_by(brain_id=brain_id).filter(
        Node.title.in_(SEED_TITLES)
    ).count()
    if existing > 0:
        brain.seed_nodes_created = True
        db.session.commit()
        return 0
    created = 0
    node_ids_ordered = []
    for title, content in zip(SEED_TITLES, SEED_CONTENT):
        node_id = str(uuid.uuid4())
        node_ids_ordered.append(node_id)
        node = Node(
            id=node_id,
            brain_id=brain_id,
            title=title,
            markdown_content=content,
            tags=["seed", "example"],
            node_type="seed",
            related_node_ids=[],
        )
        db.session.add(node)
        created += 1
    db.session.flush()
    for j in range(len(node_ids_ordered) - 1):
        n = Node.query.get(node_ids_ordered[j])
        if n:
            n.related_node_ids = [node_ids_ordered[j + 1]]
    brain.seed_nodes_created = True
    db.session.commit()
    return created

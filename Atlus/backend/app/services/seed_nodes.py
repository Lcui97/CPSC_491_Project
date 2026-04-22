"""Drop in a few starter markdown notes once per new brain (no-op if we already did)."""
import uuid
from app.extensions import db
from app.models.brain import Brain, Node

SEED_TITLES = [
    "Welcome to your Brain",
    "Handwriting + Markdown",
    "Example links and tags",
]

SEED_CONTENT = [
    """# Welcome to your Brain

This is your first note. You can write in **Markdown** and keep ideas organized.

- Add new notes with **+ New Note** in the sidebar.
- Upload handwritten pages when you create a brain or use OCR — your **scan shows on the left** and **editable Markdown on the right**.""",
    """# Handwriting + Markdown

## Notes
- Edit in the editor; use **Edit** / **Preview** / **Split**.
- Sources for this brain appear in the **Context** panel on the right.

## Scans
- After OCR, open the note to see the original image beside the transcript.""",
    """# Example links and tags

Add `tags` to notes (e.g. `#concept`, `#todo`) to keep topics organized.

Reference other notes by title in your own words.""",
]


def ensure_seed_nodes(brain_id: str) -> int:
    """Insert welcome notes if this brain hasn't been seeded; returns how many we added."""
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
    for title, content in zip(SEED_TITLES, SEED_CONTENT):
        node_id = str(uuid.uuid4())
        node = Node(
            id=node_id,
            brain_id=brain_id,
            title=title,
            markdown_content=content,
            tags=["seed", "example"],
            node_type="seed",
            related_node_ids=None,
        )
        db.session.add(node)
        created += 1
    brain.seed_nodes_created = True
    db.session.commit()
    return created

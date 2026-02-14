# Brain Ingestion & Knowledge Graph Architecture

This document describes the refactored Brain system: document ingestion at creation time, textbook PDF → nodes, handwritten notes (OCR + split view), and node linking via Pinecone.

---

## 1. File Structure

```
Atlus/
├── backend/
│   ├── app/
│   │   ├── __init__.py              # Registers brain blueprint
│   │   ├── config.py
│   │   ├── extensions.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   └── brain.py             # Brain, SourceFile, Node, NodeRelationship
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── home.py
│   │   │   ├── google_auth.py
│   │   │   └── brain.py             # /brain/create, /ingest, /ocr, /generate-nodes, /list, /<id>/nodes
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── pdf_extractor.py     # PDF text extraction (PyPDF2)
│   │   │   ├── chunker.py           # Section-aware chunking
│   │   │   ├── openai_service.py    # Embeddings + node generation (GPT)
│   │   │   ├── pinecone_service.py  # Upsert + similarity search
│   │   │   ├── ocr_service.py       # EasyOCR + GPT → Markdown
│   │   │   ├── node_generation.py   # Chunks/markdown → nodes, embed, link
│   │   │   └── ingestion_pipeline.py # Orchestrate PDF/text ingest
│   │   └── utils/
│   ├── requirements.txt
│   └── .env.example                 # OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX
│
├── frontend/
│   └── src/
│       ├── api/
│       │   └── client.js            # api(), apiUpload() for JSON and multipart
│       ├── components/
│       │   └── home/
│       │       ├── BrainCreateModal.jsx      # Create Brain + drag-drop ingestion + handwritten step
│       │       ├── HandwrittenNotesSplitView.jsx  # Left: image, Right: Markdown
│       │       ├── BrainFilters.jsx         # List + Add → opens BrainCreateModal, /api/brain/list
│       │       ├── ShareBrainModal.jsx
│       │       ├── GraphView.jsx
│       │       └── ...
│       └── pages/
│           ├── Home.jsx
│           ├── DocumentIngestion.jsx
│           └── ...
│
└── docs/
    └── BRAIN_INGESTION_ARCHITECTURE.md  # This file
```

---

## 2. Backend Route Scaffolding

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/brain/create` | Create Brain (JSON: name, badge; optional multipart: files[]). If PDF/txt/md included, ingest at creation time. |
| POST | `/api/brain/ingest` | Ingest documents into existing Brain (form: brain_id, files[]). PDF/txt/md → extract → chunk → generate nodes. |
| POST | `/api/brain/ocr` | OCR image (form: brain_id, file). Returns `{ markdown, raw_text, preview_url }` for split-view. |
| POST | `/api/brain/generate-nodes` | From chunks or single markdown, generate nodes via OpenAI, store embeddings in Pinecone, metadata in Postgres, then auto-link by similarity. |
| GET | `/api/brain/list` | List brains for current user. |
| GET | `/api/brain/<brain_id>/nodes` | Get nodes for a brain (for graph view). |

All brain routes require JWT (`@jwt_required()`). Brain ownership is enforced by `user_id`.

---

## 3. Step-by-Step Flows

### 3.1 Brain creation with documents (UI + backend)

1. User clicks **Add brain** in sidebar → **BrainCreateModal** opens.
2. User enters **name** and **badge** (Notes / Textbook / Compare).
3. User **drags or selects** files: PDF, JPEG/PNG, TXT, Markdown.
4. User clicks **Create Brain**.
5. Frontend: `apiUpload('/api/brain/create', { name, badge }, documentFiles)` (and any image files are not sent in create; see 3.3).
6. Backend: `POST /api/brain/create`
   - Creates `Brain` in Postgres.
   - If `files[]` present: for each **PDF/txt/md** file, calls `ingest_documents()` (see 3.2). **Images** are not ingested here; they are handled in the handwritten step (3.3).
7. If user had **image files**, modal switches to **handwritten** step (split view) for each image (3.3). Otherwise modal closes and new brain appears in sidebar.

### 3.2 Textbook upload (PDF/txt/md) → nodes

1. **Ingest** (at create or via `POST /api/brain/ingest`):
   - **PDF**: `pdf_extractor.extract_text_from_pdf()` → full text.
   - **TXT/MD**: read file content.
2. **Chunk**: `chunker.chunk_by_sections(text)` → list of `Chunk(text, section_title)`.
3. For each chunk (or in batch):
   - **OpenAI**: `openai_service.generate_node_from_chunk(chunk)` → `title`, `summary`, `concepts`, `related_topics`.
   - **Embed**: `openai_service.get_embeddings_batch(texts)`.
   - **Pinecone**: `pinecone_service.upsert_vectors(brain_id, vectors, ids, metadatas)` (metadata: brain_id, section_title, tags, source_reference).
   - **Postgres**: insert `Node` (id, brain_id, source_file_id, title, summary, raw_content, concepts, section_title, embedding_id, metadata_json).
4. **Link**: For each new node, `pinecone_service.similarity_search(brain_id, embedding, threshold=0.78)` → update `Node.related_node_ids` and optionally `NodeRelationship` table.
5. `SourceFile` row is created per file (brain_id, filename, file_type).

### 3.3 Handwritten notes (split view + OCR)

1. After **Create Brain** (or when adding to existing brain), if there are **image files**, modal shows **HandwrittenNotesSplitView** (or equivalent inline):
   - **Left**: original image preview.
   - **Right**: “Convert to Markdown” → calls `POST /api/brain/ocr` with `brain_id` and `file`.
2. Backend **OCR**:
   - `ocr_service.run_ocr_to_markdown(file)`:
     - Image: EasyOCR → raw text → `openai_service.generate_markdown_structure(ocr_text)` → Markdown.
     - PDF: try text extraction; if minimal, could use PDF-to-image + OCR (optional; currently images only).
   - Response: `{ markdown, raw_text, preview_url }`.
3. Frontend shows Markdown on the right; user clicks **Save as node**.
4. Frontend: `POST /api/brain/generate-nodes` with `{ brain_id, markdown }`.
5. Backend: `node_generation.generate_and_store_nodes(brain_id, ..., markdown=markdown)`:
   - Single node from markdown (title, summary, concepts from GPT).
   - Embed → Pinecone, insert Node in Postgres, run similarity search and set `related_node_ids`.

### 3.4 Node linking (after embeddings)

1. After each node’s embedding is upserted to Pinecone:
   - `similarity_search(brain_id, embedding, top_k=4, threshold=0.78, exclude_ids=[self_id])`.
2. If score ≥ threshold, add that node id to `Node.related_node_ids`.
3. Optionally persist edges in `NodeRelationship` (source_node_id, target_node_id, similarity_score) for the graph API.

---

## 4. Data Model (Postgres)

- **Brain**: id (UUID), name, badge, user_id, created_at.
- **SourceFile**: id, brain_id, filename, file_type, storage_path.
- **Node**: id (UUID), brain_id, source_file_id, title, summary, raw_content, concepts (JSON), section_title, embedding_id (Pinecone id), metadata_json, related_node_ids (JSON), created_at.
- **NodeRelationship** (optional): source_node_id, target_node_id, similarity_score.

Pinecone index must exist with dimension matching the embedding model (e.g. 1536 for `text-embedding-3-small`). Create index with metadata index for `brain_id` (and optionally section_title, tags) for filtered queries.

---

## 5. Environment

- **OPENAI_API_KEY**: required for embeddings and node/markdown generation.
- **PINECONE_API_KEY** and **PINECONE_INDEX**: required for vector store and similarity search.
- See `backend/.env.example`.

---

## 6. Modularity and Production Notes

- **Services** are separate modules (pdf, chunker, openai, pinecone, ocr, node_generation, ingestion_pipeline); replace or extend per environment (e.g. swap PyPDF2 for PyMuPDF, or EasyOCR for Tesseract).
- **Node generation** is synchronous; for large textbooks, consider background jobs (Celery/RQ) and progress via polling or WebSocket.
- **File storage**: currently only metadata in DB; for production, store files in S3/GCS and set `SourceFile.storage_path`.
- **Pinecone**: create index with correct dimension and metadata index; use namespace per brain if you need strict isolation.

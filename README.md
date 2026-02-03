# 🧠 BrainKB
### *Your Second Brain, Augmented by AI*

BrainKB is a full-stack personal knowledge management system designed to turn static notes and textbooks into an interactive, visual, and intelligent "knowledge graph." 

The core philosophy: **Upload → Chat → Visualize → Validate.**

---

## 🔬 Core AI Logic (The Math)

BrainKB uses Vector Embeddings to link your notes. The relationship between your personal notes ($N$) and textbook concepts ($T$) is determined by **Cosine Similarity**:

$$\text{similarity} = \cos(\theta) = \frac{\mathbf{N} \cdot \mathbf{T}}{\|\mathbf{N}\| \|\mathbf{T}\|}$$

For the **RAG (Retrieval-Augmented Generation)** pipeline, we retrieve the top-$k$ context blocks ($C$) based on a user query ($q$):

$$C = \text{arg max}_{c \in D} \sum_{i=1}^{k} \text{score}(q, c_i)$$

This allows the AI to ground its answers in your specific data rather than general training knowledge.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Backend** | Flask (Python), SQLAlchemy |
| **Authentication** | JWT, Google OAuth 2.0 |
| **Database** | SQLite (Dev) → PostgreSQL (Prod) |
| **AI/ML** | OpenAI API, ChromaDB, LangChain |

---

## 🏗️ Project Structure

```text
brainkb/
├── atlus/
│   ├── backend/          # Flask API & Database models
│   │   ├── migrations/   # Database version control
│   │   └── run.py        # Entry point
│   └── frontend/         # React + Vite application
│       ├── src/
│       │   ├── components/
│       │   └── pages/
│       └── tailwind.config.js
└── README.md

🧪 Getting Started
1. Backend Setup (Flask)
Bash
cd atlus/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
Note: Ensure your .env contains a valid JWT_SECRET_KEY and GOOGLE_CLIENT_ID.

2. Frontend Setup (React)
Bash
cd atlus/frontend
npm install
cp .env.example .env
npm run dev
🗺️ Roadmap
[x] Phase 0: JWT & Google OAuth Integration.

[x] Phase 1: Dashboard UI & Protected Routing.

[ ] Phase 2: Document Ingestion (PDF/Markdown/OCR).

[ ] Phase 3: Vector Embeddings & Similarity Search.

[ ] Phase 4: Obsidian-style Knowledge Graph Visualization.

[ ] Phase 5: Knowledge Gap Analysis (Notes vs. Textbooks).

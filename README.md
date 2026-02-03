# 🧠
### *Your Second Brain, Augmented by AI*

BrainKB is a full-stack personal knowledge management system designed to turn static notes and textbooks into an interactive, visual, and intelligent "knowledge graph." 

The core philosophy: **Upload → Chat → Visualize → Validate.**

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Backend** | Flask (Python), SQLAlchemy |
| **Authentication** | JWT, Google OAuth 2.0 |
| **Database** | SQLite (Dev) → PostgreSQL (Prod) |
| **AI/ML** | OpenAI API, ChromaDB, LangChain |


🧪 Getting Started
1. Backend Setup (Flask)
Bash
# Navigate to backend directory
cd atlus/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
Note: Ensure your .env contains a valid JWT_SECRET_KEY and GOOGLE_CLIENT_ID.

2. Frontend Setup (React)
Bash
# Navigate to frontend directory
cd atlus/frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev


🗺️ Roadmap

[x] Phase 0: JWT & Google OAuth Integration.

[x] Phase 1: Dashboard UI & Protected Routing.

[ ] Phase 2: Document Ingestion (PDF/Markdown/OCR).

[ ] Phase 3: Vector Embeddings & Similarity Search.

[ ] Phase 4: Obsidian-style Knowledge Graph Visualization.

[ ] Phase 5: Knowledge Gap Analysis (Notes vs. Textbooks).

# 🧠 BrainKB — AI Personal Knowledge Base

BrainKB is a full-stack web app designed to become your **personal AI knowledge system**.

The goal is simple:

> Upload your notes and textbooks → chat with them → generate a concept map (“brain”) → compare your understanding to authoritative sources.

This project is being built **from the ground up**, starting with authentication and a clean architecture that will scale into:

- Document ingestion (notes + textbooks)
- OCR for handwritten notes
- Vector search (RAG chat)
- Concept graph visualization (like Obsidian)
- Automatic comparison of your notes vs textbooks to find gaps or mistakes

---

## 🚧 Current Stage (MVP Foundation)

Right now the project includes:

- Flask backend with JWT authentication
- Google Sign-In
- React frontend with protected routes
- Dark theme dashboard Home screen
- Clean structure ready for document + AI features

This is the foundation everything else will build on.

---


---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Flask, JWT, SQLAlchemy |
| Frontend | React, Vite, Tailwind |
| Auth | Email/Password + Google OAuth |
| Database | SQLite (dev) → PostgreSQL (later) |
| AI (next phase) | OpenAI, Chroma/Pinecone |

---

## 🧪 How to Run the Project

### 🔐 Backend (Flask)

```bash
cd atlus/backend
python -m venv venv
# activate venv
pip install -r requirements.txt

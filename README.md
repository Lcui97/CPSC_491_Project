🧠 — AI-Powered Personal Knowledge Base

BrainKB is a web app that lets you chat with your own notes and textbooks, automatically build a concept graph (“brain”) from them, and compare your notes against authoritative sources to find gaps or mistakes.

This project is built with:

Flask (backend API)

React + Vite (frontend)

PostgreSQL (database)

Chroma / Pinecone (vector database — later)

OpenAI API (embeddings, reasoning — later)


⚙️ Prerequisites

Make sure you have installed:

Python 3.10+

Node.js 18+

Git


🔐 Backend Setup (Flask)
1. Go to backend
cd backend

2. Create virtual environment
python -m venv venv
source venv/bin/activate      # Mac/Linux
venv\Scripts\activate         # Windows

3. Install dependencies
pip install -r requirements.txt

4. Create .env file

Create backend/.env:

SECRET_KEY=supersecret
JWT_SECRET_KEY=superjwtsecret
SQLALCHEMY_DATABASE_URI=sqlite:///app.db

5. Run the server
python run.py


Backend runs on:

http://127.0.0.1:5000

💻 Frontend Setup (React + Vite)
1. Go to frontend
cd frontend

2. Install dependencies
npm install

3. Create .env

Create frontend/.env:

VITE_API_URL=http://127.0.0.1:5000

4. Start frontend
npm run dev


Frontend runs on:

http://localhost:5173

🔄 How It Works (Current)

User registers or logs in

Flask returns a JWT token

React stores token in localStorage

Protected /home page verifies the user

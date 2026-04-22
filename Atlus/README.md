# Atlus

A class and notes workspace: syllabi, calendar, document upload, OCR, and an AI assistant (when configured).  
This repo is a **Flask + SQLite** backend and a **React (Vite)** frontend.

---

## Prerequisites

| Tool | Notes |
|------|--------|
| **Python** | 3.10+ recommended |
| **Node.js** | 18+ (for npm / Vite) |

Optional APIs (features degrade gracefully without them):

- **OPENAI_API_KEY** — Chat, OCR, ingest helpers, assistant; leave empty for a simpler local mode.
- **PINECONE_**_* — Vector search when you enable that pipeline.
- **Google OAuth** — Only used when you build/run the frontend with a real `VITE_GOOGLE_CLIENT_ID` (see below).

---

## 1. Backend (API)

From the **`Atlus/backend`** folder:

### Create environment

```bash
cd backend
python -m venv venv
```

**Windows (PowerShell):**

```powershell
.\venv\Scripts\Activate.ps1
```

**macOS / Linux:**

```bash
source venv/bin/activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Configure secrets

Copy the example env file and edit it:

```bash
copy .env.example .env
```

On macOS/Linux use `cp .env.example .env`.

At minimum set:

- **`SECRET_KEY`** and **`JWT_SECRET_KEY`** — any long random strings for development (use strong values in production).

Optional (see comments inside `.env.example`):

- **`OPENAI_API_KEY`** — Powers AI features.
- **`GOOGLE_CLIENT_ID`** — Must match the Google OAuth client you use on the frontend if you use Google sign-in.

The app loads **`backend/.env`** automatically and defaults to **SQLite** at `sqlite:///app.db` (database file appears under `backend/` when you first run).

### Start the server

```bash
python run.py
```

The API listens on **http://127.0.0.1:5000** by default (Flask dev server).

---

## 2. Frontend (web UI)

Open a **second** terminal. From **`Atlus/frontend`**:

```bash
cd frontend
npm install
npm run dev
```

Vite usually serves the app at **http://localhost:5173**.

### API URL during development

The Vite config **proxies** `/api` to `http://127.0.0.1:5000`, so you can leave **`VITE_API_URL` empty** in a `.env` file (or omit it). Requests like `/api/...` then hit your local Flask server.

Optional: copy `frontend/.env.example` to `frontend/.env` and adjust:

- **`VITE_API_URL`** — For example `http://127.0.0.1:5000` if you call the API with an absolute base URL. For default dev with the proxy, keep it unset or blank.
- **`VITE_GOOGLE_CLIENT_ID`** — Required for Google sign-in on a **deployed** or non-localhost URL. On `localhost`, the app is set up to use email/password unless you configure Google for local dev.

### Build for production

```bash
npm run build
```

Static files are written to **`frontend/dist`**. Serve them with any static host and point **`VITE_API_URL`** at your public API URL when you build.

---

## 3. Using the app

1. Start **backend**, then **frontend**.
2. Open **http://localhost:5173** (or your Vite URL).
3. **Register** or **log in** with email and password (or Google, if configured).
4. After login you’ll land on **Home**, where you can add classes, upload syllabi, open **Notes**, **Calendar**, **Ingest**, and the **Assistant** when the API keys are set.

If the login page says the backend is unreachable, confirm Flask is running on port **5000** and that nothing else is blocking it.

---

## Project layout (short)

| Path | Role |
|------|------|
| `backend/` | Flask app, `run.py`, `requirements.txt`, `.env` |
| `frontend/` | Vite + React, `npm run dev` / `npm run build` |

---

## Troubleshooting

- **401 / OpenAI errors** — Check `OPENAI_API_KEY` in `backend/.env`. On Windows, a user-level `OPENAI_API_KEY` in Environment Variables can override the file; the app tries to prefer `.env`, but fix duplicates if issues persist.
- **CORS / API errors in dev** — Use the Vite dev server (`npm run dev`) so `/api` is proxied, or set `VITE_API_URL` to match where Flask runs.
- **Database** — Default SQLite lives alongside the backend process; back up `app.db` (or your custom path if you set `SQLALCHEMY_DATABASE_URI`).

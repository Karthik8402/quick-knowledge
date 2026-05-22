# Quick Knowledge — Intelligent Knowledge Base

[![CI/CD Pipeline](https://github.com/Karthik8402/intelligent-knowledge/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Karthik8402/intelligent-knowledge/actions/workflows/ci-cd.yml)
[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A production-grade **Retrieval-Augmented Generation (RAG)** application for intelligent document Q&A. Upload your files, ask questions in natural language, and get grounded answers with validated citations — powered by FastAPI, React 19, LangGraph, and Supabase.

**🌐 Live App:** [knowledge.karthikdev.app](https://knowledge.karthikdev.app)
**⚡ API:** [api-knowledge.karthikdev.app](https://api-knowledge.karthikdev.app)
**📖 API Docs:** [api-knowledge.karthikdev.app/docs](https://api-knowledge.karthikdev.app/docs)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **📁 Smart Upload** | Drag-and-drop PDF, TXT, DOCX, and Markdown files. Duplicate detection via SHA-256 content hash. |
| **🔍 Vector Indexing** | Documents are chunked, embedded, and stored in ChromaDB (dev) or Supabase pgvector (prod). |
| **💬 Grounded Q&A** | Ask questions and get answers with validated citations pointing to exact source chunks. |
| **⚡ Real-Time Streaming** | Chat responses stream via Server-Sent Events (SSE) for a fluid, live-typing experience. |
| **🤖 Multi-LLM Support** | Switch between Google Gemini, OpenAI, NVIDIA AI, and Groq at runtime. |
| **🛡️ Self-RAG Grading** | Chunks are graded for relevance before being sent to the LLM — preventing hallucination. |
| **🔒 JWT Auth** | Supabase Auth with Row-Level Security (RLS) — each user sees only their own documents. |
| **📊 Usage Tracking** | Per-user daily AI request quota (50 requests/day) with automatic midnight reset. |
| **🚨 Prompt Guard** | Chat input is scanned for jailbreak / injection patterns and safely blocked. |
| **📝 File Validation** | Files validated by extension AND magic bytes — prevents type spoofing attacks. |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 3, React Router DOM v7, Framer Motion |
| **State Management** | Zustand 5 |
| **Backend** | FastAPI, Python 3.12, Pydantic Settings v2 |
| **RAG / LLM** | LangChain, LangGraph, Google Gemini, OpenAI, NVIDIA AI, Groq |
| **Embeddings** | Google `gemini-embedding-001` (default), OpenAI, Hugging Face |
| **Vector Store** | ChromaDB (dev), Supabase pgvector (prod), FAISS (alternative) |
| **Storage** | Local filesystem (dev), Supabase Storage (prod) |
| **Auth** | Supabase Auth (JWT) — optional in dev, enforced in prod |
| **Testing** | Vitest + React Testing Library (frontend), pytest + pytest-cov (backend) |
| **Deployment** | Render (backend Docker), Vercel (frontend), Supabase (DB / storage / auth) |

---

## 🧠 Architecture Overview

```
┌─────────────────────┐      REST / SSE       ┌──────────────────────────────────────┐
│  React SPA          │ ◄───────────────────►  │         FastAPI Backend              │
│  knowledge.         │                        │  ┌──────────┐ ┌──────────┐ ┌──────┐ │
│  karthikdev.app     │                        │  │ Upload   │ │  Chat    │ │System│ │
└─────────────────────┘                        │  │ Service  │ │ Service  │ │Routes│ │
          │                                    │  └─────┬────┘ └─────┬────┘ └──────┘ │
          │ Supabase Auth (JWT)                │        │            │               │
          ▼                                    │  ┌─────▼────────────▼───┐           │
┌─────────────────────┐                        │  │  LangGraph RAG Agent │           │
│  Supabase           │ ◄──────────────────────┼──│  Retrieve → Grade    │           │
│  (Auth / DB /       │    user_id / RLS        │  │  → Generate          │           │
│   Storage)          │                        │  └─────────────────────┘           │
└─────────────────────┘                        │        │                            │
                                               │  ┌─────▼──────┐  ┌──────────────┐  │
                                               │  │ Vector     │◄─│  ChromaDB    │  │
                                               │  │ Store      │  │  (pgvector   │  │
                                               │  └────────────┘  │   or FAISS)  │  │
                                               │                  └──────────────┘  │
                                               └─────────────────────────────────────┘
```

### RAG Pipeline (LangGraph — 3 nodes)

1. **Retrieve** — Fetch top-k chunks using MMR (Max Marginal Relevance) with owner-scoped filtering.
2. **Grade** — Filter chunks by relevance threshold (≥ 0.3). Prevents hallucination by blocking irrelevant context.
3. **Generate** — Produce a grounded answer with validated citations. Falls back to extractive summary if needed.

---

## 📁 Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI factory + middleware + lifespan
│   │   ├── config.py               # Pydantic settings (env-driven)
│   │   ├── dependencies.py         # FastAPI dependency injection
│   │   ├── exceptions.py           # Custom exception classes
│   │   ├── api/v1/
│   │   │   ├── api.py              # Router aggregator
│   │   │   └── endpoints/
│   │   │       ├── chat.py         # /chat, /chat/stream
│   │   │       ├── documents.py    # /documents CRUD
│   │   │       └── system.py       # /health, /status, /settings, /usage
│   │   ├── agents/graph.py         # LangGraph RAG pipeline (3-node graph)
│   │   ├── services/
│   │   │   ├── chat_service.py     # Chat logic, prompt injection guard, citations
│   │   │   ├── document_service.py # Upload, list, delete, chunk inspection
│   │   │   └── usage_service.py    # Daily quota tracking
│   │   ├── core/
│   │   │   ├── auth.py             # JWT / Supabase auth + UserContext
│   │   │   └── supabase.py         # Supabase client + storage helpers
│   │   ├── schemas/__init__.py     # Pydantic request/response models
│   │   ├── generation.py           # LLM wrapper + answer builder
│   │   ├── retrieval.py            # Vector store builder + MMR retrieval
│   │   ├── ingest.py               # Document parsing + chunking pipeline
│   │   ├── citations.py            # Citation index validation
│   │   └── storage.py              # Document registry (local JSON / Supabase)
│   ├── tests/                      # 90+ pytest test cases
│   ├── requirements.txt
│   ├── .env.example                # Template — copy to .env
│   └── pyproject.toml              # pytest + ruff config
├── frontend/
│   ├── src/
│   │   ├── main.tsx                # App entry point
│   │   ├── App.tsx                 # Router + auth provider
│   │   ├── api.ts                  # HTTP client with SSE, caching, auth headers
│   │   ├── types.ts                # Shared TypeScript types
│   │   ├── lib/supabase.ts         # Supabase client factory
│   │   ├── hooks/useAuth.ts        # Auth context + session management
│   │   ├── services/usage.ts       # Zustand usage quota store
│   │   ├── config/
│   │   │   ├── api.ts              # API / frontend URL config
│   │   │   └── branding.ts         # Brand info + supported LLM model list
│   │   ├── core/Layout.tsx         # Responsive app shell with sidebar
│   │   ├── pages/
│   │   │   ├── Home.tsx            # Public landing page
│   │   │   ├── Dashboard.tsx       # Main dashboard with stats
│   │   │   ├── SettingsPage.tsx    # RAG engine settings panel
│   │   │   ├── StatusPage.tsx      # Live system telemetry
│   │   │   └── ProfilePage.tsx     # User profile + usage stats
│   │   ├── features/
│   │   │   ├── chat/ChatPage.tsx   # SSE streaming chat UI
│   │   │   ├── documents/
│   │   │   │   ├── DocumentsPage.tsx  # Drag-and-drop upload + document list
│   │   │   │   └── ChunksPage.tsx     # Chunk explorer with metadata
│   │   │   └── auth/
│   │   │       ├── Login.tsx
│   │   │       ├── Register.tsx
│   │   │       ├── ForgotPassword.tsx
│   │   │       ├── ResetPassword.tsx
│   │   │       └── AuthCallback.tsx
│   │   ├── components/ui/          # Button, Card, Input, LoadingSpinner, ConfirmToast
│   │   ├── shared/                 # Skeleton loaders, event-driven Toast system
│   │   └── index.css               # Tailwind + custom animations
│   ├── package.json
│   ├── vite.config.mjs
│   ├── tailwind.config.js
│   ├── vercel.json                 # SPA rewrite rules + security headers
│   └── .env.example
├── supabase/
│   └── migrations/001_init.sql     # pgvector + documents table + RLS policies
├── docs/
│   ├── DEPLOYMENT.md               # Full deployment guide + rollback
│   ├── environment-reference.md    # Complete environment variable reference
│   ├── rag-workflow.md             # End-to-end RAG flow documentation
│   └── google-gemma-setup.md       # Configuring Google Gemma models
├── Dockerfile                      # Production Docker image (backend only)
├── render.yaml                     # Render Blueprint (IaC)
└── .github/workflows/ci-cd.yml     # GitHub Actions CI/CD pipeline
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Minimum Version |
|------|----------------|
| **Python** | 3.12+ |
| **Node.js** | 20+ |
| **Git** | any recent |
| **Google AI API Key** | [Get one here](https://aistudio.google.com/app/apikey) |
| **Supabase Account** | [Free tier](https://supabase.com) (for production features) |

### 1. Clone the Repository

```bash
git clone https://github.com/Karthik8402/intelligent-knowledge.git
cd intelligent-knowledge
```

---

## 🐍 Backend Setup

### Development

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt

# Copy the environment template
cp .env.example .env
# On Windows:
copy .env.example .env

# Edit .env — at minimum set GOOGLE_API_KEY
# GOOGLE_API_KEY=your-key-here

# Start the development server with hot-reload
python -m uvicorn app.main:app --reload --port 8000
```

**API Explorer:** Open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser.

### Production (Gunicorn)

```bash
cd backend

gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --workers 1 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

> **Note:** Use `--workers 1` on free hosting tiers (like Render's 512MB plan) to prevent SQLite write lock conflicts with ChromaDB.

---

## ⚛️ Frontend Setup

### Development

```bash
cd frontend

# Install dependencies
npm install

# Copy the environment template
cp .env.example .env.local
# On Windows:
copy .env.example .env.local

# Edit .env.local:
# VITE_API_URL=http://localhost:8000
# VITE_AUTH_ENABLED=false   ← disables login in local dev

# Start the development server
npm run dev
```

**App URL:** Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
cd frontend
npm run build
# Output: frontend/dist/
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_API_KEY` | *(required)* | Google AI API key for Gemini LLM + embeddings |
| `LLM_PROVIDER` | `google` | LLM provider: `google` / `openai` / `nvidia` / `groq` |
| `LLM_MODEL` | `gemini-3.1-flash-lite` | Model identifier |
| `LLM_TEMPERATURE` | `0.2` | Response creativity (0.0–1.0) |
| `OPENAI_API_KEY` | *(optional)* | Required when `LLM_PROVIDER=openai` |
| `GROQ_API_KEY` | *(optional)* | Required when `LLM_PROVIDER=groq` |
| `EMBEDDING_PROVIDER` | `google` | Embedding provider: `google` / `openai` / `huggingface` |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Embedding model identifier |
| `STORAGE_BACKEND` | `local` | `local` (dev) or `supabase` (prod) |
| `VECTOR_STORE` | `chroma` | `chroma` (dev) / `pgvector` (prod) / `faiss` |
| `AUTH_ENABLED` | `false` | Set `true` in production to enforce Supabase JWT |
| `SUPABASE_URL` | — | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | — | Supabase anonymous / public key |
| `SUPABASE_SERVICE_KEY` | — | Supabase service role key (for backend writes) |
| `SUPABASE_JWT_SECRET` | — | JWT secret from Supabase dashboard |
| `DATABASE_URL` | — | Postgres connection string (for pgvector) |
| `RAG_TOP_K` | `6` | Number of chunks to retrieve per query |
| `RAG_CHUNK_SIZE` | `800` | Characters per document chunk |
| `RAG_CHUNK_OVERLAP` | `150` | Character overlap between chunks |
| `MAX_UPLOAD_SIZE_MB` | `25` | Maximum file upload size |
| `RATE_LIMIT` | `10/minute` | Global per-IP rate limit |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated list of allowed origins |

### Frontend (`frontend/.env.local`)

| Variable | Example | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API origin |
| `VITE_FRONTEND_URL` | `http://localhost:5173` | Frontend origin (for auth callbacks) |
| `VITE_ENV` | `local` | Environment label: `local` / `production` |
| `VITE_AUTH_ENABLED` | `false` | Enable (`true`) or disable (`false`) auth UI |
| `VITE_SUPABASE_URL` | `https://*.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase anonymous key |

---

## 🌐 API Reference

### System Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | ❌ | Root status check |
| `GET` | `/health` | ❌ | Deep health check (disk, vectors, embeddings, Supabase) |
| `GET` | `/status` | ✅ | Document/chunk counts, provider status |
| `GET` | `/system/config` | ❌ | Active system configuration |
| `GET` | `/usage` | ✅ | Daily AI request quota usage |
| `GET` | `/settings` | ✅ | View active runtime settings |
| `PUT` | `/settings` | ✅ | Update settings in memory (resets on restart) |

### Document Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| `POST` | `/documents/upload` | ✅ | 5/min | Upload files (PDF, TXT, DOCX, MD) |
| `GET` | `/documents` | ✅ | — | List all documents for the user |
| `DELETE` | `/documents/{id}` | ✅ | — | Delete document and its vectors |
| `GET` | `/documents/{id}/chunks` | ✅ | — | Inspect indexed chunks with metadata |

### Chat Endpoints

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| `POST` | `/chat` | ✅ | 20/min | Q&A — returns JSON with citations |
| `POST` | `/chat/stream` | ✅ | 15/min | Streaming Q&A via SSE |

---

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Make sure the virtual environment is active
.\venv\Scripts\activate  # Windows
# or: source venv/bin/activate

# Set PYTHONPATH to find the app module
$env:PYTHONPATH = "."  # Windows PowerShell
# or: export PYTHONPATH=.

# Run all tests
python -m pytest tests/ -v

# Run with coverage report
python -m pytest tests/ --cov=app --cov-report=term-missing

# Run with coverage and enforce minimum (60%)
python -m pytest tests/ --cov=app --cov-report=term-missing --cov-fail-under=60

# Run a specific test file
python -m pytest tests/test_ingest.py -v

# Run a specific test case
python -m pytest tests/test_auth.py::test_verify_jwt_valid -v
```

**Test Suites (90+ test cases):**

| File | What it Tests |
|------|--------------|
| `test_auth.py` | JWT validation, UserContext, auth bypass |
| `test_chat_service.py` | Chat logic, prompt injection guard |
| `test_citations.py` | Citation index validation |
| `test_document_service.py` | Upload, list, delete operations |
| `test_fallback.py` | Fallback answer behavior |
| `test_ingest.py` | File parsing and chunking |
| `test_retrieval.py` | MMR retrieval, owner filtering |
| `test_storage.py` | Document registry CRUD |
| `test_generation.py` | LLM response building |
| `test_config.py` | Settings validation |
| `test_api_routes.py` | HTTP endpoint contract tests |
| `test_schemas.py` | Pydantic model validation |

### Frontend Tests

```bash
cd frontend

# Run all tests once
npm test

# Run in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:ci

# Run a specific test file
npx vitest run src/features/chat/ChatPage.test.tsx
```

---

## 🚢 Deployment

### Architecture

```
GitHub (push to main)
    │
    ▼
GitHub Actions CI/CD
    ├── Backend lint, type check, security scan, tests
    ├── Frontend type check, tests, build
    ├── Smoke tests (live API contract)
    ├── Deploy backend → Render (via Deploy Hook)
    └── Deploy frontend → Vercel (via Vercel CLI)
```

### Supabase Setup (one-time)

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run the migration:
   ```bash
   # Run contents of:
   supabase/migrations/001_init.sql
   ```
   > Run each section one at a time on the free tier to avoid timeouts.
3. Go to **Authentication → URL Configuration** and set:
   - **Site URL:** `https://knowledge.karthikdev.app`
   - **Redirect URLs:** `https://knowledge.karthikdev.app/**`
4. Go to **Settings → API** to retrieve your keys.
5. Go to **Storage → Buckets** and confirm the `documents` bucket was created.

### Render (Backend)

1. Push this repo to GitHub.
2. On Render, create a **Web Service** pointing to this repo.
3. Set the **Root Directory** to `/` (Dockerfile is at root).
4. Configure **Environment Variables** in the Render Dashboard:

   | Variable | Value |
   |----------|-------|
   | `GOOGLE_API_KEY` | your Google AI key |
   | `STORAGE_BACKEND` | `supabase` |
   | `VECTOR_STORE` | `chroma` |
   | `AUTH_ENABLED` | `true` |
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_ANON_KEY` | your Supabase anon key |
   | `SUPABASE_SERVICE_KEY` | your Supabase service role key |
   | `SUPABASE_JWT_SECRET` | your Supabase JWT secret |
   | `CORS_ORIGINS` | `https://knowledge.karthikdev.app` |

5. Set **Auto-Deploy** to **Off** (GitHub Actions handles deploys via Deploy Hook).
6. Add your custom domain `api-knowledge.karthikdev.app` in **Settings → Custom Domains**.

### Vercel (Frontend)

1. Import the repo into Vercel. Set the **Root Directory** to `frontend`.
2. Set **Environment Variables** in Vercel Dashboard (these are pulled by CI/CD):

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://api-knowledge.karthikdev.app` |
   | `VITE_FRONTEND_URL` | `https://knowledge.karthikdev.app` |
   | `VITE_ENV` | `production` |
   | `VITE_AUTH_ENABLED` | `true` |
   | `VITE_SUPABASE_URL` | your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |

3. Disconnect the GitHub integration (**Settings → Git → Disconnect**) to prevent double deployments. GitHub Actions will deploy via the Vercel CLI.
4. Add your custom domain `knowledge.karthikdev.app` in **Settings → Domains**.

### GitHub Actions Secrets

Set these in **Settings → Secrets and Variables → Actions** of your repository:

| Secret | Description |
|--------|-------------|
| `RENDER_DEPLOY_HOOK_URL` | Render webhook URL (from Render → Settings → Deploy Hook) |
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_ORG_ID` | Your Vercel organization ID |
| `VERCEL_PROJECT_ID` | Your Vercel project ID |

---

## 🔁 CI/CD Pipeline

The pipeline in `.github/workflows/ci-cd.yml` runs on every push to `main` or `develop`:

| Job | Trigger | Purpose |
|-----|---------|---------|
| `backend-lint` | always | Ruff static analysis |
| `backend-test` | after lint | pytest with 60% coverage gate |
| `backend-typecheck` | after lint | mypy advisory (non-blocking) |
| `backend-security` | after lint | pip-audit CVE scan + Bandit SAST |
| `frontend-validate` | always | TypeScript `tsc --noEmit` |
| `frontend-test` | after validate | Vitest unit tests + coverage |
| `frontend-build` | after validate | Vite production bundle + Vercel env pull |
| `smoke-test` | after backend-test + frontend-build | Live API contract verification |
| `deploy-backend` | main push + smoke pass | Trigger Render deploy hook + health poll |
| `deploy-frontend` | main push + smoke pass | Vercel CLI build + deploy |
| `pipeline-summary` | always | GHA markdown summary table |

---

## 🔐 Security Features

| Feature | Details |
|---------|---------|
| **Rate Limiting** | Per-IP + per-endpoint limits via `slowapi` (configurable) |
| **CORS** | Strict origin whitelist with credential support |
| **Security Headers** | CSP, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, Referrer-Policy |
| **Request IDs** | Every request tagged with `X-Request-ID` for traceability |
| **JWT Auth** | Supabase JWT on all protected routes, service-role bypass for backend ops |
| **Prompt Injection Guard** | Blocks jailbreak patterns like "ignore previous instructions" |
| **File Validation** | Extension + magic bytes validation to prevent type spoofing |
| **Citation Validation** | LLM citation indices verified against real retrieved chunks |
| **RLS** | Supabase Row-Level Security enforces strict per-user data isolation |
| **Non-root Docker** | Container runs as `appuser` (not root) |

---

## 📚 Documentation

| Doc | Description |
|-----|-------------|
| [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Full deployment guide, rollback procedures, monitoring |
| [`docs/environment-reference.md`](./docs/environment-reference.md) | Complete environment variable reference |
| [`docs/rag-workflow.md`](./docs/rag-workflow.md) | End-to-end ingestion, retrieval, and generation flow |
| [`docs/google-gemma-setup.md`](./docs/google-gemma-setup.md) | Configuring Google Gemma models |
| [`supabase/migrations/001_init.sql`](./supabase/migrations/001_init.sql) | Database schema + RLS policies |

---

## 📝 Notes

- **Vector Store:** `chroma` (ChromaDB) is the default for local dev. Use `pgvector` + `STORAGE_BACKEND=supabase` in production.
- **Duplicate Detection:** Files are deduplicated by SHA-256 content hash before ingestion.
- **Settings Persistence:** Updates via `PUT /settings` apply in-memory only — they reset on restart.
- **Daily Quota:** 50 AI requests per user per day, reset at midnight UTC.
- **Streaming Fallback:** If SSE token streaming times out, the system falls back to a non-streaming response.
- **Worker Count:** Keep Gunicorn at `--workers 1` on Render's free tier (512MB RAM) to prevent ChromaDB SQLite lock contention.

---

## 📄 License

[MIT](LICENSE) — feel free to fork and adapt for your own knowledge base.

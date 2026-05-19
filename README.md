# Quick Knowledge — Intelligent Knowledge Base

A production-minded Retrieval-Augmented Generation (RAG) application for grounded document Q&A. Upload files, index them into a vector store, and ask questions with validated citations and real-time streaming responses. Built with FastAPI, React 19, LangGraph, and Supabase.

## What This App Does

- **Upload & Ingest** — Drag-and-drop PDF, TXT, DOCX, and Markdown files. Duplicate uploads are detected via content hash (SHA-256).
- **Vector Indexing** — Documents are split into chunks, embedded, and stored in ChromaDB (local) or Supabase pgvector (production).
- **Grounded Q&A** — Ask questions in natural language. The system retrieves relevant chunks, grades them for relevance (self-RAG), and generates an answer with validated citations.
- **Real-Time Streaming** — Chat responses stream via Server-Sent Events (SSE) for a fluid UX.
- **Multi-Modal LLMs** — Toggle between Google Gemini, OpenAI, NVIDIA AI, and Groq LLMs at runtime.
- **Smart Fallbacks** — When no relevant context is found, the system responds with a controlled fallback. If chunks exist but the LLM returns the fallback, an extractive summary is used instead.
- **Daily Usage Tracking** — Per-user AI request quota (50 requests/day) with automatic daily reset.
- **Secure by Default** — CORS, rate limiting, JWT auth (Supabase), prompt injection detection, and hardened security headers.
- **Prompt Injection Guard** — Chat input is scanned for jailbreak patterns; blocked requests return a safe response.

> **Fallback phrase:** `Sorry, I could not find this information in your uploaded documents.`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 6, Vite 8, Tailwind CSS 3, React Router DOM v7, Framer Motion 12 |
| **State Management** | Zustand 5 |
| **Backend** | FastAPI, Python 3.12, Pydantic Settings 2 |
| **RAG / LLM** | LangChain, LangGraph, Google Gemini, OpenAI, NVIDIA AI, Groq |
| **Embeddings** | Google `gemini-embedding-001` (default), OpenAI, Hugging Face |
| **Vector Store** | ChromaDB (dev), Supabase pgvector (prod), FAISS (alternative) |
| **Storage** | Local filesystem (dev), Supabase Storage (prod) |
| **Auth** | Supabase Auth (JWT) — optional in development, enforced in production |
| **Testing** | Vitest 4 + React Testing Library (frontend), pytest + pytest-cov (backend) |
| **Deployment** | Render (backend Docker), Vercel (frontend), Supabase (DB / storage / auth) |
| **Notifications** | react-hot-toast, custom Toast component |

---

## Architecture Overview

```
┌─────────────┐      REST / SSE       ┌─────────────────────────────────────┐
│  React SPA  │ ◄──────────────────►  │           FastAPI Backend           │
│  (Vercel)   │                       │  ┌─────────┐ ┌─────────┐ ┌───────┐  │
└─────────────┘                       │  │ Upload  │ │  Chat   │ │System │  │
       │                              │  │ Service │ │ Service │ │Routes │  │
       │ Supabase Auth (JWT)          │  └────┬────┘ └────┬────┘ └───────┘  │
       ▼                              │       │           │                 │
┌─────────────┐                       │  ┌────▼───────────▼────┐            │
│  Supabase   │ ◄─────────────────────┼──►  LangGraph RAG      │            │
│  (Auth/DB)  │    user_id / RLS      │     Retrieve → Grade   │            │
└─────────────┘                       │     → Generate         │            │
                                      │  └─────────────────────┘            │
                                      │       │                             │
                                      │  ┌────▼────┐    ┌─────────────┐      │
                                      │  │ Vector  │◄──►│  ChromaDB   │      │
                                      │  │ Store   │    │  (or pgvector│      │
                                      │  └─────────┘    │   or FAISS) │      │
                                      │                 └─────────────┘      │
                                      └─────────────────────────────────────┘
```

### RAG Agent Pipeline (LangGraph)

1. **Retrieve** — Fetch top-k chunks from the vector store using MMR (Max Marginal Relevance) with owner-scoped filtering.
2. **Grade** — Filter chunks by a relevance threshold (≥ 0.3). This self-RAG step prevents the LLM from seeing irrelevant context.
3. **Generate** — Produce a grounded answer with validated citations. If no chunks pass grading, the pipeline returns the fallback immediately — saving API costs.

---

## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI factory + middleware + lifespan
│   │   ├── config.py               # Pydantic settings (env-based)
│   │   ├── dependencies.py         # FastAPI dependency injection
│   │   ├── exceptions.py           # Custom exception classes
│   │   ├── api/v1/
│   │   │   ├── api.py              # Router aggregator
│   │   │   └── endpoints/
│   │   │       ├── chat.py         # /chat, /chat/stream
│   │   │       ├── documents.py    # /documents CRUD
│   │   │       └── system.py       # /health, /status, /settings, /usage, /system/config
│   │   ├── agents/graph.py         # LangGraph RAG pipeline
│   │   ├── services/
│   │   │   ├── chat_service.py     # Chat logic, prompt injection, citations
│   │   │   ├── document_service.py # Upload, list, delete, chunks
│   │   │   └── usage_service.py    # Daily usage quota tracking
│   │   ├── core/
│   │   │   ├── auth.py             # JWT / Supabase auth
│   │   │   └── supabase.py         # Supabase client & storage helpers
│   │   ├── schemas/__init__.py     # Pydantic request/response models
│   │   ├── generation.py           # LLM wrapper + answer builder
│   │   ├── retrieval.py            # Vector store builder + MMR retrieval
│   │   ├── ingest.py               # Document parsing + chunking
│   │   ├── citations.py            # Citation index validation
│   │   └── storage.py              # Document registry (local JSON / Supabase)
│   ├── tests/                      # 13+ pytest suites
│   ├── requirements.txt
│   ├── .env.example
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── main.tsx                # App entry point
│   │   ├── App.tsx                 # Router + auth provider
│   │   ├── api.ts                  # HTTP client with SSE, caching, auth
│   │   ├── types.ts                # Shared TypeScript types
│   │   ├── lib/supabase.ts         # Supabase client factory
│   │   ├── hooks/useAuth.ts        # Auth context + provider
│   │   ├── services/usage.ts       # Zustand usage store
│   │   ├── config/
│   │   │   ├── api.ts              # API / frontend URL config
│   │   │   └── branding.ts         # Brand info + model configs
│   │   ├── core/Layout.tsx         # Responsive app shell with sidebar
│   │   ├── pages/
│   │   │   ├── Home.tsx            # Public landing page
│   │   │   ├── Dashboard.tsx       # Main dashboard with stats
│   │   │   ├── SettingsPage.tsx    # RAG engine settings
│   │   │   ├── StatusPage.tsx      # System telemetry
│   │   │   └── ProfilePage.tsx     # User profile + usage stats
│   │   ├── features/
│   │   │   ├── chat/ChatPage.tsx   # SSE streaming chat UI
│   │   │   ├── documents/
│   │   │   │   ├── DocumentsPage.tsx  # Drag-and-drop upload + list
│   │   │   │   └── ChunksPage.tsx     # Chunk explorer
│   │   │   └── auth/
│   │   │       ├── Login.tsx
│   │   │       ├── Register.tsx
│   │   │       ├── ForgotPassword.tsx
│   │   │       ├── ResetPassword.tsx
│   │   │       └── AuthCallback.tsx
│   │   ├── components/ui/          # Button, Card, Input, LoadingSpinner, ConfirmToast
│   │   ├── shared/                 # Skeleton, Toast (event-driven)
│   │   └── index.css               # Tailwind + custom animations
│   ├── package.json
│   ├── vite.config.mjs
│   ├── tailwind.config.js
│   ├── vercel.json                 # SPA rewrite + security headers
│   └── .env.example
├── supabase/
│   └── migrations/001_init.sql     # pgvector + documents table + RLS
├── docs/
│   ├── DEPLOYMENT.md
│   ├── environment-reference.md
│   ├── google-gemma-setup.md
│   └── rag-workflow.md
├── Dockerfile                      # Multi-stage production image (backend)
└── render.yaml                     # Render Blueprint (IaC)
```

---

## Prerequisites

- **Python** ≥ 3.12
- **Node.js** ≥ 20
- **Git**
- (Optional) **Supabase** account for production features
- (Optional) **Google AI API key** for Gemini embeddings / LLM

---

## Backend Setup

```powershell
cd backend

# 1. Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
copy .env.example .env
# Edit .env: set GOOGLE_API_KEY (or another provider key)

# 4. Run development server
python -m uvicorn app.main:app --reload --port 8000
```

### Production Server

```powershell
cd backend
gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --workers 2 --timeout 120
```

**API docs (auto-generated):** `http://localhost:8000/docs`

---

## Frontend Setup

```powershell
cd frontend

# 1. Install dependencies
npm install

# 2. Configure environment
copy .env.example .env
# Edit .env: VITE_API_URL=http://localhost:8000

# 3. Run development server
npm run dev
```

Default UI: `http://localhost:5173`

### Build for Production

```powershell
cd frontend
npm run build
```

Static output is emitted to `frontend/dist/` and can be served by Vercel, Nginx, etc.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `google` | google / openai / nvidia / groq |
| `LLM_MODEL` | `gemini-3.1-flash-lite` | Model identifier |
| `LLM_TEMPERATURE` | `0.2` | Sampling temperature |
| `LLM_TOP_P` | `1.0` | Nucleus sampling parameter |
| `LLM_MAX_TOKENS` | *(optional)* | Max output tokens (used by NVIDIA) |
| `GOOGLE_API_KEY` | *(required)* | API key for Google AI |
| `OPENAI_API_KEY` | *(optional)* | Required when LLM_PROVIDER=openai |
| `GROQ_API_KEY` | *(optional)* | Required when LLM_PROVIDER=groq |
| `EMBEDDING_PROVIDER` | `google` | google / openai / huggingface |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Embedding model identifier |
| `STORAGE_BACKEND` | `local` | `local` (dev) or `supabase` (prod) |
| `VECTOR_STORE` | `chroma` | `chroma` (dev) or `pgvector` (prod) or `faiss` |
| `AUTH_ENABLED` | `false` | `true` in production when using Supabase Auth |
| `RAG_TOP_K` | `6` | Number of chunks to retrieve |
| `RAG_CHUNK_SIZE` | `800` | Character size per chunk |
| `RAG_CHUNK_OVERLAP` | `150` | Overlap between chunks |
| `SUPABASE_*` | — | Required when `STORAGE_BACKEND=supabase` |
| `DATABASE_URL` | — | Postgres connection string for pgvector |
| `RATE_LIMIT` | `10/minute` | Per-IP rate limit |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `REDIS_URL` | *(optional)* | Redis connection for caching |

See `docs/environment-reference.md` for the complete variable reference.

### Frontend (`frontend/.env`)

| Variable | Example | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API origin |
| `VITE_FRONTEND_URL` | `http://localhost:5173` | Frontend origin |
| `VITE_ENV` | `local` | Environment label |
| `VITE_AUTH_ENABLED` | `true` | Enable/disable auth UI |
| `VITE_SUPABASE_URL` | `https://*.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase anon key |

---

## API Endpoints

### Root
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | No | Root status check |

### Documents
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/documents/upload` | Yes | Upload PDF / TXT / DOCX / MD files (max 5 req/min) |
| `GET`  | `/documents` | Yes | List uploaded documents |
| `DELETE`| `/documents/{id}` | Yes | Remove document + vectors |
| `GET`  | `/documents/{id}/chunks` | Yes | Inspect indexed chunks |

### Chat
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/chat` | Yes | Ask a question — returns JSON with citations (max 20 req/min) |
| `POST` | `/chat/stream` | Yes | Streaming Q&A via SSE (max 15 req/min) |

### System
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | No | Deep health check (disk, vectors, embeddings) |
| `GET` | `/status` | Yes | Document / chunk counts, provider status |
| `GET` | `/system/config` | No | System configuration info |
| `GET` | `/usage` | Yes | Daily AI request quota usage |
| `GET` | `/settings` | Yes | View active runtime settings |
| `PUT` | `/settings` | Yes | Update settings in memory |

---

## Deployment

### Render (Backend)

1. Push this repo to GitHub.
2. In Render, create a **Blueprint** and point it at `render.yaml`.
3. Set secret values in the Render Dashboard (`GOOGLE_API_KEY`, `SUPABASE_*`, `DATABASE_URL`, `CORS_ORIGINS`).
4. Render builds the Docker image and deploys the FastAPI service.

> The included `Dockerfile` runs a non-root user, exposes port `8000`, and uses `gunicorn` + `uvicorn` workers with a health check (`/health`, interval=30s).

### Vercel (Frontend)

1. Import the `frontend/` directory into a new Vercel project (set root directory to `frontend`).
2. Set environment variables: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Deploy — Vercel builds with `npm run build` automatically. Includes SPA rewrite rules and security headers via `vercel.json`.

### Supabase (Production Dependencies)

Required when `STORAGE_BACKEND=supabase` and `AUTH_ENABLED=true`:

- **Auth** — Supabase Auth with JWT validation on every protected route.
- **Storage** — File uploads go to a Supabase Storage bucket (`documents`).
- **Postgres + pgvector** — Chunk embeddings stored in a vector-enabled table.

Run migrations in `supabase/migrations/001_init.sql` to set up tables, indexes, and RLS policies.

---

## CI/CD Pipeline

This project includes a comprehensive GitHub Actions CI/CD pipeline that automatically runs on every push and pull request to `main` / `develop`:

### Quality Gates (CI)
- **Backend** — Linting (Ruff), Type Checking (MyPy advisory), Security Scanning (pip-audit + Bandit), Unit Tests (pytest with 60% coverage gate)
- **Frontend** — Type Checking (TypeScript), Unit Tests (Vitest with v8 coverage)
- **Smoke Tests** — API health, status, documents, and chat endpoint validation

### Deployment (CD)
- **Frontend** — Automatically deployed to Vercel on `main` branch pushes
- **Backend** — Automatically deployed to Render via deploy hook on `main` branch pushes

### Pipeline Jobs

The pipeline is defined in `.github/workflows/ci-cd.yml` with 11 jobs:

1. **Backend / Ruff** — Static analysis with Ruff
2. **Backend / Tests** — pytest with coverage gate (≥ 60%)
3. **Backend / Type Check** — mypy advisory (non-blocking)
4. **Backend / Security Advisory** — pip-audit CVE scan + Bandit SAST
5. **Frontend / Type Check** — TypeScript `tsc --noEmit`
6. **Frontend / Tests** — Vitest unit tests + coverage
7. **Frontend / Build** — Vite production bundle
8. **Smoke Test** — Live API contract verification
9. **Deploy / Backend to Render** — Render deploy hook + health poll
10. **Deploy / Frontend to Vercel** — Vercel CLI production deploy
11. **Pipeline / Summary** — Markdown summary table in GHA UI

### Required GitHub Secrets

Set these in your repository **Settings → Secrets and Variables → Actions**:

| Secret | Used By | Description |
|--------|---------|-------------|
| `RENDER_DEPLOY_HOOK_URL` | `deploy-backend` | Render webhook URL to trigger deployment |
| `VERCEL_TOKEN` | `deploy-frontend` | Vercel personal access token |
| `VERCEL_ORG_ID` | `deploy-frontend` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | `deploy-frontend` | Vercel project ID |
| `VITE_API_URL` | `frontend-build` | Production backend URL |
| `VITE_FRONTEND_URL` | `frontend-build` | Production frontend URL |
| `VITE_SUPABASE_URL` | `frontend-build` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `frontend-build` | Supabase anonymous key |

### Pipeline Status

[![CI/CD Pipeline](https://github.com/your-username/intelligent-knowledge/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/your-username/intelligent-knowledge/actions/workflows/ci-cd.yml)

---

## Testing

### Backend

```powershell
cd backend
python -m pytest tests/ -v

# With coverage
python -m pytest tests/ --cov=app --cov-report=term-missing
```

Suites cover: API routes, auth, chat service, citations, config, document service, fallback behavior, generation, ingestion, retrieval, and storage.

### Frontend

```powershell
cd frontend
npm test              # run once
npm run test:watch    # watch mode
npm run test:ci       # with coverage report (v8)
```

---

## Security Features

- **Rate Limiting** — Per-IP and per-endpoint rate limiting with `slowapi` (configurable via `RATE_LIMIT`).
- **CORS** — Origin whitelist with credential support.
- **Security Headers** — `X-Content-Type-Options`, `X-Frame-Options`, `CSP`, `Permissions-Policy`, `Referrer-Policy`, and more via middleware. Vercel also adds `X-XSS-Protection`.
- **Request IDs** — Every request is tagged with an `X-Request-ID` for traceability.
- **Prompt Injection Guard** — Chat input is scanned for jailbreak patterns (e.g., "ignore previous instructions", "you are now a", system prompt overrides); blocked requests return a safe response.
- **JWT Authentication** — Optional in local development, enforced in production via Supabase Auth tokens with service-role backend bypass.
- **Citation Validation** — Backend validates that every citation index maps to a real retrieved chunk. If the LLM returns no citations, defaults to Source 1.
- **Extractive Fallback** — When the LLM returns the fallback answer despite having relevant chunks, the system falls back to an extractive summary from the retrieved content.
- **File Type Validation** — Uploaded files are validated by both extension and magic bytes to prevent type spoofing.
- **Row-Level Security** — Supabase RLS policies enforce data isolation by `owner_id` on all document operations.

---

## Documentation

- `docs/DEPLOYMENT.md` — Full deployment guide, rollback procedures, monitoring URLs
- `docs/environment-reference.md` — Complete environment variable reference
- `docs/rag-workflow.md` — End-to-end ingestion, retrieval, and generation flow
- `docs/google-gemma-setup.md` — Configuring Google Gemma models

---

## Notes

- `VECTOR_STORE=chroma` is the default for local development. `VECTOR_STORE=pgvector` and `STORAGE_BACKEND=supabase` are recommended for production. FAISS is also supported.
- Duplicate uploads are rejected using a file content hash (`sha256`).
- The LangGraph pipeline is executed synchronously per request with 3 nodes (retrieve, grade, generate).
- Settings updates via `PUT /settings` are applied in memory and do **not** persist to `.env`.
- Daily AI request quota: **50 requests per user per day** (resets at midnight UTC).
- The chat service includes an automatic document filter for queries mentioning "resume" / "CV".
- Streaming uses SSE via `sse-starlette` with fallback to non-streaming if a token timeout occurs.

---

## License

[MIT](LICENSE) — feel free to fork and adapt for your own knowledge base.

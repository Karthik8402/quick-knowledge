# Production Deployment Guide

Quick Knowledge RAG App — production setup for Vercel (frontend), Render (backend), and Supabase (storage/auth).

## Architecture

```
Frontend (Vercel) ──→ Backend (Render) ──→ Supabase (Storage + Auth)
                      │
                      └──→ ChromaDB (vectors, local on Render)
                      └──→ Google Gemini (LLM + Embeddings)
```

## Prerequisites

- [Vercel](https://vercel.com) account
- [Render](https://render.com) account (free tier, Oregon region)
- [Supabase](https://supabase.com) project (Ohio region)
- [Google AI Studio](https://aistudio.google.com) API key
- [GitHub](https://github.com) repository
- [Vercel CLI](https://vercel.com/docs/cli) installed locally

## GitHub Secrets Required

Go to **GitHub → Repository → Settings → Secrets and variables → Actions** and add:

| Secret | Value | Purpose |
|--------|-------|---------|
| `VERCEL_TOKEN` | `vercel token create` | Vercel CLI authentication |
| `VERCEL_ORG_ID` | From `vercel ls` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | From project settings | Vercel project ID |
| `RENDER_DEPLOY_HOOK_URL` | From Render Dashboard | Trigger backend deploy |

### How to get Vercel secrets

```bash
vercel login
vercel link          # Link to existing project
vercel env ls        # Verify env vars
# VERCEL_ORG_ID and VERCEL_PROJECT_ID are in .vercel/project.json after linking
# VERCEL_TOKEN: vercel token create
```

### How to get Render deploy hook URL

1. Render Dashboard → Select service → Settings
2. Scroll to "Deploy Hooks"
3. Create a new hook, copy the URL
4. Add as `RENDER_DEPLOY_HOOK_URL` in GitHub Secrets

## Supabase Setup

### 1. Run Database Migration

Go to **Supabase Dashboard → SQL Editor** and run these statements **one at a time** (free tier can timeout on large batches):

```sql
-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'pdf',
    pages INTEGER NOT NULL DEFAULT 0,
    chunks INTEGER NOT NULL DEFAULT 0,
    content_hash TEXT NOT NULL,
    owner_id UUID NOT NULL,
    storage_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);

-- Step 4: Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS policies (run each separately)
CREATE POLICY "Users can view own documents" ON documents FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own documents" ON documents FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can delete own documents" ON documents FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Users can update own documents" ON documents FOR UPDATE USING (auth.uid() = owner_id);

-- Step 6: Create storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 26214400, ARRAY['application/pdf','text/plain','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;
```

### 2. Get Supabase Keys

Go to **Supabase Dashboard → Settings → API**:

- `Project URL`: `https://<project>.supabase.co`
- `anon public`: Starts with `eyJhbGci...`
- `service_role` (secret): Starts with `eyJhbGci...`
- `JWT Secret`: Long string under "Config"

### 3. Enable Email Auth (optional)

**Supabase Dashboard → Authentication → Providers → Email**: Enable "Confirm email" if desired.

## Vercel Frontend Setup

### Environment Variables

Run these commands (replace values with your actual keys):

```bash
vercel env add VITE_SUPABASE_URL production
# Enter: https://rvvcwchwpohyonhbsvsp.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Enter: your_supabase_anon_key

vercel env add VITE_AUTH_ENABLED production
# Enter: true

vercel env add VITE_API_URL production
# Enter: https://intelligent-knowledge.onrender.com

vercel env add VITE_FRONTEND_URL production
# Enter: https://knowledge.karthikdev.app

vercel env add VITE_ENV production
# Enter: production
```

Verify:
```bash
vercel env ls production
```

### Deploy

```bash
vercel deploy --prod
```

### Custom Domain

```bash
vercel domains add knowledge.karthikdev.app
```

Then configure DNS (CNAME to `cname.vercel-dns.com`).

## Render Backend Setup

### Environment Variables

In **Render Dashboard → Service → Environment**, set:

| Key | Value | Type |
|-----|-------|------|
| `PYTHON_VERSION` | `3.12` | Plain |
| `STORAGE_BACKEND` | `supabase` | Plain |
| `VECTOR_STORE` | `chroma` | Plain |
| `CHROMA_PERSIST_DIR` | `./data/chroma` | Plain |
| `AUTH_ENABLED` | `true` | Plain |
| `LLM_PROVIDER` | `google` | Plain |
| `LLM_MODEL` | `gemini-3.1-flash-lite` | Plain |
| `EMBEDDING_PROVIDER` | `google` | Plain |
| `EMBEDDING_MODEL` | `gemini-embedding-001` | Plain |
| `RAG_TOP_K` | `5` | Plain |
| `RAG_CHUNK_SIZE` | `1000` | Plain |
| `RAG_CHUNK_OVERLAP` | `200` | Plain |
| `MAX_UPLOAD_SIZE_MB` | `25` | Plain |
| `RATE_LIMIT` | `10/minute` | Plain |
| `GOOGLE_API_KEY` | `your_google_api_key` | **Secret** |
| `SUPABASE_URL` | `https://<project>.supabase.co` | **Secret** |
| `SUPABASE_ANON_KEY` | `your_supabase_anon_key` | **Secret** |
| `SUPABASE_SERVICE_KEY` | `your_supabase_service_key` | **Secret** |
| `SUPABASE_JWT_SECRET` | `your_jwt_secret` | **Secret** |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,https://intelligent-knowledge.vercel.app,https://knowledge.karthikdev.app` | **Secret** |

### Health Check

After deploy, verify:
```bash
curl https://intelligent-knowledge.onrender.com/health | python3 -m json.tool
```

Expected response:
```json
{
  "status": "healthy",
  "storage_backend": "supabase",
  "vector_store": "chroma",
  "auth_enabled": true,
  "checks": {
    "vector_store": true,
    "embeddings": true,
    "supabase_connection": true
  }
}
```

## CI/CD Pipeline

The `.github/workflows/ci-cd.yml` pipeline runs on every push to `main`:

1. **Backend**: Ruff lint → Tests → Type check → Security scan → Smoke test
2. **Frontend**: TypeScript check → Tests → Build
3. **Deploy**: Backend to Render → Frontend to Vercel (with health verification)

### Required GitHub Secrets for CI/CD

| Secret | Source |
|--------|--------|
| `VERCEL_TOKEN` | `vercel token create` |
| `VERCEL_ORG_ID` | `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` |
| `RENDER_DEPLOY_HOOK_URL` | Render Dashboard → Deploy Hooks |

## Verification Checklist

After deployment, verify:

- [ ] `GET https://knowledge.karthikdev.app` → 200, loads UI
- [ ] `GET https://intelligent-knowledge.onrender.com/health` → `"status": "healthy"`
- [ ] `GET https://intelligent-knowledge.onrender.com/health` → `"supabase_connection": true`
- [ ] Login/Signup works (if `AUTH_ENABLED=true`)
- [ ] Document upload succeeds (PDF, TXT, MD, DOCX)
- [ ] Chat Q&A returns answers with citations
- [ ] `/documents` page shows uploaded files

## Troubleshooting

### "Authentication is disabled for this environment"
- Vercel Dashboard → Project → Settings → Environment Variables
- Ensure all 6 `VITE_*` vars are set for Production environment
- Redeploy: `vercel deploy --prod`

### Document upload fails
- Verify Supabase migration ran (check `documents` table exists in Table Editor)
- Verify `documents` storage bucket exists (Storage → Buckets)
- Check Render logs for errors

### Backend /health shows `"supabase_connection": false`
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in Render Dashboard
- Check Render logs: `curl -H "Authorization: Bearer <render-api-key>" https://api.render.com/v1/services/<id>/logs`

### ChromaDB data lost on Render restart
- Render free tier filesystem is ephemeral
- Consider migrating to Supabase pgvector for persistent vectors (requires IPv6-compatible Render plan or different pgvector host)

### Vercel build fails with missing env vars
- `.env.production` is `.gitignored` (by design)
- All env vars must be set in Vercel Dashboard
- Verify with: `vercel env ls production`

## Security Notes

- **Never commit** `.env.production`, `.env.local`, or any file containing secrets
- Supabase `anon` key is public-facing (used in frontend bundle) — acceptable by design
- Supabase `service_role` key is **server-side only** — never expose in frontend
- RLS policies restrict database access to authenticated users' own data
- Backend uses `service_role` key which bypasses RLS (intended for server-side operations)

# Environment Reference

This file documents all backend environment variables.

## Core provider settings

- `LLM_PROVIDER`
  - Allowed: `google`, `openai`, `nvidia`, `groq`
  - Default: `google`

- `LLM_MODEL`
  - Default: `gemini-3.1-flash-lite`
  - Example alternatives: `gpt-4o-mini`, `gemma-3-27b-it`, `llama-3.3-70b-versatile`

- `LLM_TEMPERATURE`
  - Default: `0.2`

- `LLM_TOP_P`
  - Default: `1.0`

- `LLM_MAX_TOKENS`
  - Optional maximum output tokens (used by NVIDIA)

- `LLM_TIMEOUT_SECONDS`
  - Default: `45.0`
  - Timeout for LLM API calls

- `GOOGLE_API_KEY`
  - Required when `LLM_PROVIDER=google` or `EMBEDDING_PROVIDER=google`

- `OPENAI_API_KEY`
  - Required when `LLM_PROVIDER=openai` or `EMBEDDING_PROVIDER=openai`

- `NVIDIA_API_KEY`
  - Required when `LLM_PROVIDER=nvidia`

- `GROQ_API_KEY`
  - Required when `LLM_PROVIDER=groq`

## Embedding settings

- `EMBEDDING_PROVIDER`
  - Allowed: `google`, `openai`, `huggingface`
  - Default: `google`

- `EMBEDDING_MODEL`
  - Default: `gemini-embedding-001`

## Vector and storage settings

- `VECTOR_STORE`
  - Allowed: `chroma`, `pgvector`, `faiss`
  - Default: `chroma`

- `STORAGE_BACKEND`
  - Allowed: `local`, `supabase`
  - Default: `local`

- `CHROMA_PERSIST_DIR`
  - Default: `./data/chroma`

- `UPLOAD_DIR`
  - Default: `./data/uploads`

- `METADATA_DB_PATH`
  - Default: `./data/document_registry.json`

- `SQLITE_DB_PATH`
  - Default: `./data/knowledge_base.db`

## RAG tuning settings

- `RAG_TOP_K`
  - Default: `6`

- `RAG_CHUNK_SIZE`
  - Default: `800`

- `RAG_CHUNK_OVERLAP`
  - Default: `150`

- `MAX_UPLOAD_SIZE_MB`
  - Default: `25`

- `RATE_LIMIT`
  - Default: `10/minute`

- `CORS_ORIGINS`
  - Default: `http://localhost:5173,http://127.0.0.1:5173,https://intelligent-knowledge.vercel.app`

## Auth settings

- `AUTH_ENABLED`
  - Allowed: `true`, `false`
  - Default: `false`

## Supabase settings (required when `STORAGE_BACKEND=supabase`)

- `SUPABASE_URL`
  - Your Supabase project URL

- `SUPABASE_ANON_KEY`
  - Supabase anonymous/public key (safe for client-side use)

- `SUPABASE_SERVICE_KEY`
  - Supabase service role key (server-side only, bypasses RLS)

- `SUPABASE_JWT_SECRET`
  - JWT secret for auth token validation

- `DATABASE_URL`
  - Postgres connection string (required when `VECTOR_STORE=pgvector`)

- `SUPABASE_STORAGE_BUCKET`
  - Default: `documents`

## Optional

- `REDIS_URL`
  - Redis connection string for optional caching layer

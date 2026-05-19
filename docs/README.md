# Documentation Index

This folder contains setup, deployment, and operational guides for the Quick Knowledge platform.

## Files

| File | Description |
|------|-------------|
| `DEPLOYMENT.md` | Full deployment architecture, CI/CD pipeline stages, required secrets (GitHub + Render), rollback procedures, and monitoring URLs. |
| `environment-reference.md` | Complete backend environment variable reference with allowed values, defaults, and descriptions. |
| `api-reference.md` | Comprehensive API reference for all endpoints with request/response examples. |
| `auth-guide.md` | Authentication setup guide covering Supabase Auth configuration, JWT flow, and frontend/backend implementation. |
| `rag-workflow.md` | End-to-end flow for document ingestion, vector retrieval, grounded answer generation, and fallback behavior. |

## Quick Start

For new contributors, read in this order:

1. **`rag-workflow.md`** — Understand how the RAG pipeline works end-to-end.
2. **`environment-reference.md`** — Set up your local environment variables.
3. **`api-reference.md`** — Explore available API endpoints.
4. **`auth-guide.md`** — Configure authentication (required for production).
5. **`DEPLOYMENT.md`** — Deploy to production (Render + Vercel + Supabase).

## Related

- [Root README](../README.md) — Project overview, setup, testing, and features.

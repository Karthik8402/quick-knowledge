# API Reference

Base URL: `http://localhost:8000` (local) or `https://intelligent-knowledge.onrender.com` (production)

Interactive docs: `{base_url}/docs`

## Authentication

Most endpoints require a Bearer JWT token in the `Authorization` header:

```
Authorization: Bearer <supabase-access-token>
```

When `AUTH_ENABLED=false` (local dev), auth is bypassed.

---

## Root

### `GET /`

Returns a simple status message.

**Response:**
```json
{
  "status": "ok",
  "message": "Intelligent Knowledge Base API is running"
}
```

---

## Chat

### `POST /chat`

Ask a question and receive a grounded answer with citations.

**Rate Limit:** 20 requests per minute

**Request:**
```json
{
  "question": "What is this document about?",
  "document_ids": ["doc-123", "doc-456"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | Yes | Natural language question |
| `document_ids` | array[string] | No | Filter to specific documents |

**Response:**
```json
{
  "answer": "This document describes...",
  "citations": [
    {
      "document_id": "doc-123",
      "file_name": "report.pdf",
      "page": 3,
      "snippet": "The key findings indicate..."
    }
  ],
  "retrieved_chunks": [
    {
      "document_id": "doc-123",
      "file_name": "report.pdf",
      "page": 3,
      "score": 0.89,
      "text": "The key findings indicate..."
    }
  ]
}
```

### `POST /chat/stream`

Same as `/chat` but streams the answer token-by-token via Server-Sent Events (SSE).

**Rate Limit:** 15 requests per minute

**Request:** Same as `/chat`

**Response (SSE Events):**

```
event: token
data: The

event: token
data:  answer

event: citations
data: [{"document_id": "doc-123", "file_name": "report.pdf", "page": 3, "snippet": "..."}]

event: done
data:
```

---

## Documents

### `POST /documents/upload`

Upload one or more files for ingestion.

**Rate Limit:** 5 requests per minute

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | file[] | Yes | PDF, TXT, DOCX, or Markdown files (max 25MB each) |

**Response:**
```json
[
  {
    "document_id": "doc-abc123",
    "file_name": "report.pdf",
    "pages": 5,
    "chunks": 23,
    "status": "indexed"
  }
]
```

### `GET /documents`

List all uploaded documents for the authenticated user.

**Response:**
```json
{
  "documents": [
    {
      "document_id": "doc-abc123",
      "file_name": "report.pdf",
      "source_type": "pdf",
      "pages": 5,
      "chunks": 23,
      "content_hash": "sha256:abc...",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### `DELETE /documents/{document_id}`

Delete a document and its vector embeddings.

**Response:**
```json
{
  "status": "deleted",
  "document": {
    "document_id": "doc-abc123",
    "file_name": "report.pdf"
  }
}
```

### `GET /documents/{document_id}/chunks`

Retrieve all chunks for a specific document.

**Response:**
```json
{
  "document_id": "doc-abc123",
  "chunks": [
    {
      "text": "The key findings indicate...",
      "page": 3
    }
  ]
}
```

---

## System

### `GET /health`

Deep health check (no auth required).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "uptime_seconds": 3600,
  "version": "3.0.0",
  "python_version": "3.12.0",
  "disk_free_mb": 1024.5,
  "storage_backend": "local",
  "vector_store": "chroma",
  "auth_enabled": false,
  "checks": {
    "vector_store": true,
    "embeddings": true,
    "disk_space_ok": true
  }
}
```

### `GET /status`

Get system status and document counts for the authenticated user.

**Response:**
```json
{
  "vector_store": "chroma",
  "llm_provider": "google",
  "store_initialized": true,
  "embeddings_loaded": true,
  "documents": 5,
  "chunks": 42
}
```

### `GET /system/config`

Get system configuration info (no auth required).

**Response:**
```json
{
  "configured": true,
  "init_error": null,
  "llm_provider": "google",
  "llm_model": "gemini-3.1-flash-lite",
  "embedding_provider": "google",
  "embedding_model": "gemini-embedding-001",
  "vector_store": "chroma"
}
```

### `GET /usage`

Get daily AI request usage for the authenticated user.

**Response:**
```json
{
  "used": 3,
  "limit": 50,
  "remaining": 47,
  "percentage": 6,
  "reset_at": "2025-01-16T00:00:00Z",
  "plan": "Free",
  "status": "active"
}
```

### `GET /settings`

Get current runtime RAG settings.

**Response:**
```json
{
  "rag_top_k": 6,
  "rag_chunk_size": 800,
  "rag_chunk_overlap": 150,
  "llm_provider": "google",
  "llm_model": "gemini-3.1-flash-lite",
  "llm_temperature": 0.2,
  "llm_top_p": 1.0,
  "embedding_model": "gemini-embedding-001",
  "vector_store": "chroma",
  "max_upload_size_mb": 25
}
```

### `PUT /settings`

Update runtime RAG settings (in-memory only, not persisted).

**Request:** Partial update of settings fields.

**Response:**
```json
{
  "status": "updated_in_memory",
  "settings": { "...same as GET /settings..." }
}
```

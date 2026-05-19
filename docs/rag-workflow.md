# RAG Workflow

This document describes the end-to-end workflow used by the application.

## Ingestion pipeline

1. User uploads PDF, TXT, DOCX, or Markdown files.
2. Backend validates file extension and file size.
3. Files are saved to `UPLOAD_DIR`.
4. A content hash is computed for duplicate detection.
5. Documents are parsed into text pages or segments.
6. Text is split using `RecursiveCharacterTextSplitter`.
7. Metadata is attached to each chunk:
   - document_id
   - file_name
   - page
   - source_type
   - chunk_index
   - created_at
8. Chunk embeddings are generated.
9. Chunks are indexed in the vector store.
10. Registry metadata is saved for listing and deletion.

## Retrieval and answer pipeline

1. User sends a question from the chat UI via standard API or SSE streaming endpoint (`/chat/stream`).
2. Backend retrieves top-k relevant chunks from vector store.
3. Chunks are formatted as numbered sources.
4. LLM receives strict instructions:
   - Answer only from context.
   - Return fallback if answer is missing.
   - Return citation indices as JSON.
5. Citation indices are validated against retrieved sources.
6. API returns (or streams):
   - grounded answer (token-by-token if SSE)
   - validated citations
   - retrieved chunks for traceability

## Fallback behavior

When the documents do not contain an answer, the system returns:

Sorry, I could not find this information in your uploaded documents.

## Why this design is safe

- Prevents uncited claims by validating source indices.
- Preserves page and file metadata through ingestion.
- Supports deterministic, auditable retrieval context.
- Avoids silent hallucinations by forcing explicit fallback.

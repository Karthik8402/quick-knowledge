-- ============================================================
-- Supabase Migration: Quick Knowledge Base
-- Run these statements ONE AT A TIME in the Supabase SQL Editor.
-- If one times out, retry it. Supabase free tier can be slow.
-- ============================================================

-- STEP 1: Enable the pgvector extension
-- (Run this first, wait for it to complete before proceeding)
CREATE EXTENSION IF NOT EXISTS vector;

-- STEP 2: Create documents metadata table
CREATE TABLE IF NOT EXISTS documents (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id     TEXT UNIQUE NOT NULL,
    file_name       TEXT NOT NULL,
    source_type     TEXT NOT NULL DEFAULT 'pdf',
    pages           INTEGER NOT NULL DEFAULT 0,
    chunks          INTEGER NOT NULL DEFAULT 0,
    content_hash    TEXT NOT NULL,
    owner_id        UUID NOT NULL,
    storage_path    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- STEP 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);

-- STEP 4: Enable Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- STEP 5: RLS Policies
CREATE POLICY "Users can view own documents"
    ON documents FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own documents"
    ON documents FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own documents"
    ON documents FOR DELETE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can update own documents"
    ON documents FOR UPDATE
    USING (auth.uid() = owner_id);

-- STEP 6: Create Storage bucket via SQL
-- If this fails, create manually in Dashboard > Storage > New Bucket
-- Name: "documents", Public: false, File size: 25MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false,
    26214400,
    ARRAY[
        'application/pdf',
        'text/plain',
        'text/markdown',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
) ON CONFLICT (id) DO NOTHING;

-- STEP 7: Storage bucket RLS policies
CREATE POLICY "Users can upload to documents bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own documents in bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents from bucket"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Note: The pgvector chunks table is managed automatically by
-- langchain-postgres PGVector. It creates "langchain_pg_collection"
-- and "langchain_pg_embedding" tables on first use.

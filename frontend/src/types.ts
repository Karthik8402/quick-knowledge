export type DocumentMetadata = {
  document_id: string;
  file_name: string;
  source_type: string;
  pages: number;
  chunks: number;
  content_hash: string;
  created_at: string;
};

export type UploadResult = {
  document_id: string;
  file_name: string;
  pages: number;
  chunks: number;
  status: string;
  error?: string;
};

export type Citation = {
  document_id: string;
  file_name: string;
  page: number | null;
  snippet: string;
};

export type RetrievedChunk = {
  document_id: string;
  file_name: string;
  page: number | null;
  score: number | null;
  text: string;
};

export type ChatResponse = {
  answer: string;
  citations: Citation[];
  retrieved_chunks: RetrievedChunk[];
};

export type SystemStatus = {
  vector_store: string;
  llm_provider: string;
  store_initialized: boolean;
  embeddings_loaded: boolean;
  documents: number;
  chunks: number;
};

export type RawChunk = {
  text: string;
  page: number | null;
};

export type ChunksResponse = {
  document_id: string;
  chunks: RawChunk[];
};

export type Settings = {
  rag_top_k: number;
  rag_chunk_size: number;
  rag_chunk_overlap: number;
  llm_provider: string;
  llm_model: string;
  llm_temperature: number;
  llm_top_p: number;
  embedding_model: string;
  vector_store: string;
  max_upload_size_mb: number;
};

export type UsageResponse = {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  reset_at: string;
  plan: string;
  status: 'active' | 'exhausted';
};

export type SystemConfig = {
  configured: boolean;
  init_error: string | null;
  llm_provider: string;
  llm_model: string;
  embedding_provider: string;
  embedding_model: string;
  vector_store: string;
};

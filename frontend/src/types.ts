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

/** A single turn in a conversation history. */
export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
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

export interface NotificationAction {
  label: string;
  href: string;
}

export interface NotificationItem {
  id: string;
  type: 'critical' | 'warning' | 'info';
  icon: string;
  title: string;
  body: string;
  timestamp: string;
  dismissible: boolean;
  action: NotificationAction | null;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  total: number;
  unread_count: number;
}

export interface SessionInfo {
  session_id: string;
  is_current: boolean;
  status: string;
  user_id: string;
  is_anonymous: boolean;
  auth_backend: string;
  last_activity: string | null;
  first_seen: string | null;
  document_count: number;
  created_at: string;
  device: string;
  ip: string;
  last_seen_at: string;
}

export interface SessionsResponse {
  sessions: SessionInfo[];
  total: number;
  active_count: number;
  note: string;
}

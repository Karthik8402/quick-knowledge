/**
 * Centralized branding configuration for Quick Knowledge.
 * Import BRAND from this file anywhere in the frontend instead of hardcoding names.
 */
export const BRAND = {
  name: 'Quick Knowledge',
  tagline: 'AI-Powered Knowledge Platform',
  description: 'Upload documents, index them in your vector store, and chat with an intelligent RAG workflow.',
  version: 'v3.0',
  author: 'Karthi',
  copyright: `© ${new Date().getFullYear()} Quick Knowledge`,
} as const;

/**
 * Centralized model configuration for the Settings page.
 * Maps providers to their available models with display-friendly names.
 */
export const MODEL_CONFIG: Record<string, { displayName: string; models: { id: string; name: string }[] }> = {
  google: {
    displayName: 'Google (Gemini)',
    models: [
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
      { id: 'gemini-3.1-flash-live-preview', name: 'Gemini 3.1 Flash Live' },
    ],
  },
  openai: {
    displayName: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
  },
  nvidia: {
    displayName: 'NVIDIA (AI Endpoints)',
    models: [
      { id: 'minimaxai/minimax-m2.7', name: 'MiniMax M2.7' },
    ],
  },
  groq: {
    displayName: 'Groq',
    models: [
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'llama-3.1-70b-versatile', name: 'LLaMA 3.1 70B' },
    ]
  },
};

export const EMBEDDING_MODELS = [
  { id: 'text-embedding-004', name: 'Google text-embedding-004' },
  { id: 'gemini-embedding-001', name: 'Google gemini-embedding-001' },
  { id: 'gemini-embedding-2', name: 'Google gemini-embedding-2' },
  { id: 'text-embedding-ada-002', name: 'OpenAI Ada 002' },
  { id: 'text-embedding-3-small', name: 'OpenAI Embedding 3 Small' },
];

export const VECTOR_STORES = [
  { id: 'chroma', name: 'ChromaDB (recommended)' },
  { id: 'pgvector', name: 'pgvector (Supabase Postgres)' },
  { id: 'faiss', name: 'FAISS (in-memory)' },
];

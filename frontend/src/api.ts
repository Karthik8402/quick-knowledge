import { getAccessToken } from './lib/supabase';
import type { ChatMessage, ChatResponse, ChunksResponse, Citation, DocumentMetadata, Settings, SystemStatus, UploadResult, UsageResponse, SystemConfig } from './types';
import API_BASE_URL from './config/api';

const GET_CACHE_TTL_MS = 10_000;
const HEALTH_CACHE_TTL_MS = 5_000;

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const getCache = new Map<string, CacheEntry<unknown>>();

export function clearApiCache(prefix?: string) {
  if (!prefix) {
    getCache.clear();
    return;
  }

  for (const key of getCache.keys()) {
    if (key.startsWith(prefix)) getCache.delete(key);
  }
}

function cachedGet<T>(key: string, loader: () => Promise<T>, ttlMs: number = GET_CACHE_TTL_MS): Promise<T> {
  const now = Date.now();
  const cached = getCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise as Promise<T>;
  }

  let promise: Promise<T>;
  promise = loader().catch((error) => {
    if (getCache.get(key)?.promise === promise) {
      getCache.set(key, { expiresAt: Date.now() + 2000, promise });
    }
    throw error;
  });
  getCache.set(key, { expiresAt: now + ttlMs, promise });
  return promise;
}

/**
 * Get authorization headers with the current JWT token.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Wrapper for fetch that automatically includes auth headers.
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  new Headers(options.headers).forEach((value, key) => {
    headers[key] = value;
  });
  Object.assign(headers, await authHeaders());

  const response = await fetch(url, { ...options, headers });

  // Handle auth failures globally
  if (response.status === 401) {
    clearApiCache();
    // Don't auto-redirect here, it causes infinite loops if session state is out of sync.
    // The App.tsx AuthGuard catches invalid sessions securely and react-hot-toast will show this error.
    throw new Error('Authentication expired. Please log in again.');
  }

  return response;
}


export async function uploadDocuments(files: File[]): Promise<UploadResult[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await authFetch(`${API_BASE_URL}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || errorData?.error || 'Upload failed');
  }

  const result = await response.json() as UploadResult[];
  clearApiCache();
  return result;
}

export async function listDocuments(): Promise<DocumentMetadata[]> {
  return cachedGet('GET /documents', async () => {
    const response = await authFetch(`${API_BASE_URL}/documents`);
    if (!response.ok) {
      throw new Error('Failed to list documents');
    }
    const data = await response.json();
    return data.documents;
  });
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await authFetch(`${API_BASE_URL}/documents/${documentId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
  clearApiCache();
}

export async function chat(
  question: string,
  documentIds?: string[],
  history?: ChatMessage[],
): Promise<ChatResponse> {
  const response = await authFetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      document_ids: documentIds?.length ? documentIds : null,
      history: history?.length ? history : null,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment.');
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || errorData?.error || 'Failed to send message');
  }

  return response.json() as Promise<ChatResponse>;
}

/**
 * SSE streaming chat — yields tokens in real-time and returns citations at the end.
 */
export async function chatStream(
  question: string,
  documentIds: string[] | undefined,
  onToken: (token: string) => void,
  onCitations: (citations: Citation[]) => void,
  onDone: () => void,
  onError: (error: string) => void,
  history?: ChatMessage[],
  signal?: AbortSignal,
): Promise<void> {
  const token = await getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question,
        document_ids: documentIds?.length ? documentIds : null,
        history: history?.length ? history : null,
      }),
      signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    onError(err.message || 'Failed to connect to chat stream');
    return;
  }

  if (!response.ok) {
    if (response.status === 401) {
      onError('Authentication expired. Please log in again.');
      return;
    }
    if (response.status === 429) {
      onError('Rate limit exceeded. Please wait a moment.');
      return;
    }
    const errorData = await response.json().catch(() => null);
    onError(errorData?.detail || errorData?.error || 'Failed to connect to chat stream');
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError('Streaming not supported');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';
  let dataBuffer = '';
  let doneDispatched = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (dataBuffer || currentEvent === 'done') {
        switch (currentEvent) {
          case 'token':
            onToken(dataBuffer);
            break;
          case 'citations':
            try {
              const citations = JSON.parse(dataBuffer) as Citation[];
              onCitations(citations);
            } catch { /* ignore parse errors */ }
            break;
          case 'done':
            if (!doneDispatched) { onDone(); doneDispatched = true; }
            break;
          case 'error':
            onError(dataBuffer);
            break;
        }
      }
      if (!doneDispatched) { onDone(); doneDispatched = true; }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r/g, '');
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (line === '') {
        if (dataBuffer || currentEvent === 'done') {
          switch (currentEvent) {
            case 'token':
              onToken(dataBuffer);
              break;
            case 'citations':
              try {
                const citations = JSON.parse(dataBuffer) as Citation[];
                onCitations(citations);
              } catch { /* ignore parse errors */ }
              break;
            case 'done':
              if (!doneDispatched) { onDone(); doneDispatched = true; }
              break;
            case 'error':
              onError(dataBuffer);
              break;
          }
        }
        currentEvent = 'message';
        dataBuffer = '';
      } else if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const data = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
        dataBuffer = dataBuffer ? dataBuffer + '\n' + data : data;
      }
    }
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return cachedGet('GET /status', async () => {
    const response = await authFetch(`${API_BASE_URL}/status`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || errorData?.error || 'Failed to get status');
    }
    return response.json();
  });
}

export async function getDocumentChunks(documentId: string): Promise<ChunksResponse> {
  return cachedGet(`GET /documents/${documentId}/chunks`, async () => {
    const response = await authFetch(`${API_BASE_URL}/documents/${documentId}/chunks`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || errorData?.error || 'Failed to get chunks');
    }
    return response.json();
  });
}

export async function getSettings(): Promise<Settings> {
  return cachedGet('GET /settings', async () => {
    const response = await authFetch(`${API_BASE_URL}/settings`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || errorData?.error || 'Failed to get settings');
    }
    return response.json();
  });
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  const response = await authFetch(`${API_BASE_URL}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || errorData?.error || 'Failed to update settings');
  }
  const result = await response.json();
  clearApiCache();
  return result.settings;
}

export async function getHealth(): Promise<Record<string, unknown>> {
  return cachedGet('GET /health', async () => {
    // Health endpoint is public — no auth needed
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || errorData?.error || 'Failed to get health status');
    }
    return response.json();
  }, HEALTH_CACHE_TTL_MS);
}

export async function getUsage(): Promise<UsageResponse> {
  const response = await authFetch(`${API_BASE_URL}/usage`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || errorData?.error || 'Failed to get usage stats');
  }
  return response.json() as Promise<UsageResponse>;
}

export async function getSystemConfig(): Promise<SystemConfig> {
  const response = await authFetch(`${API_BASE_URL}/system/config`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || errorData?.error || 'Failed to get system config');
  }
  return response.json() as Promise<SystemConfig>;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { chat, chatStream } from '../../api';
import type { ChatResponse, Citation } from '../../types';
import ConfirmToast from '../../components/ui/ConfirmToast';
import { useUsageStore } from '../../services/usage';
import ChatInput from './components/ChatInput';

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */
type Message = { role: 'user' | 'assistant'; text: string; data?: ChatResponse };

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

/* ──────────────────────────────────────────────
   LocalStorage helpers
   ────────────────────────────────────────────── */
const STORAGE_KEY = 'qk_chat_sessions';

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ──────────────────────────────────────────────
   Simple Markdown renderer (no external deps)
   Handles: **bold**, *italic*, `code`, ```blocks```,
   - bullet lists, numbered lists, and line breaks
   ────────────────────────────────────────────── */
function renderMarkdown(text: string) {
  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map((part, pi) => {
    // Code block
    if (part.startsWith('```')) {
      const lines = part.slice(3, -3).split('\n');
      const lang = lines[0]?.trim() || '';
      const code = (lang ? lines.slice(1) : lines).join('\n').trim();
      return (
        <div key={pi} className="my-3 rounded-xl overflow-hidden border border-outline-variant/20">
          {lang && (
            <div className="bg-surface-container-highest px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-outline border-b border-outline-variant/15">
              {lang}
            </div>
          )}
          <pre className="bg-surface-container-high/60 px-4 py-3 overflow-x-auto text-xs leading-relaxed custom-scrollbar">
            <code className="text-primary/90">{code}</code>
          </pre>
        </div>
      );
    }

    // Regular text — process inline formatting
    const lines = part.split('\n');
    return (
      <span key={pi}>
        {lines.map((line, li) => {
          const trimmed = line.trim();

          // Bullet list
          if (/^[-•]\s/.test(trimmed)) {
            return (
              <div key={li} className="flex gap-2 ml-1 my-0.5">
                <span className="text-primary/50 mt-0.5">•</span>
                <span>{renderInline(trimmed.slice(2))}</span>
              </div>
            );
          }

          // Numbered list
          if (/^\d+[.)]\s/.test(trimmed)) {
            const num = trimmed.match(/^(\d+)[.)]\s/)![1];
            const rest = trimmed.replace(/^\d+[.)]\s/, '');
            return (
              <div key={li} className="flex gap-2 ml-1 my-0.5">
                <span className="text-primary/50 font-medium min-w-[1.2em] text-right">{num}.</span>
                <span>{renderInline(rest)}</span>
              </div>
            );
          }

          // Heading-like lines (## or ###)
          if (/^#{1,3}\s/.test(trimmed)) {
            const content = trimmed.replace(/^#{1,3}\s/, '');
            return <p key={li} className="font-bold text-on-surface mt-3 mb-1">{content}</p>;
          }

          // Empty line → spacing
          if (!trimmed) return <div key={li} className="h-2" />;

          // Regular paragraph
          return <p key={li} className="my-0.5">{renderInline(line)}</p>;
        })}
      </span>
    );
  });
}

/** Inline formatting: **bold**, *italic*, `code` */
function renderInline(text: string): React.ReactNode {
  // Split by inline code, bold, italic
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return tokens.map((t, i) => {
    if (t.startsWith('**') && t.endsWith('**')) {
      return <strong key={i} className="font-bold text-on-surface">{t.slice(2, -2)}</strong>;
    }
    if (t.startsWith('*') && t.endsWith('*')) {
      return <em key={i} className="italic text-on-surface/80">{t.slice(1, -1)}</em>;
    }
    if (t.startsWith('`') && t.endsWith('`')) {
      return <code key={i} className="bg-surface-container-highest/80 text-primary px-1.5 py-0.5 rounded text-[11px] font-mono">{t.slice(1, -1)}</code>;
    }
    return t;
  });
}

/* ──────────────────────────────────────────────
   Suggestion cards
   ────────────────────────────────────────────── */
const suggestions = [
  { icon: 'summarize',     label: 'Summarize',        desc: 'Concise summary of your documents',          prompt: 'Give me a comprehensive summary of the uploaded documents' },
  { icon: 'compare',       label: 'Compare',          desc: 'Similarities & differences across docs',     prompt: 'Compare the key themes across the uploaded documents' },
  { icon: 'search',        label: 'Extract',          desc: 'Pull out specific data points or facts',     prompt: 'What are the most important facts in the documents?' },
  { icon: 'analytics',     label: 'Analyze',          desc: 'Deep analysis of content patterns',          prompt: 'Analyze the main arguments and conclusions in the documents' },
  { icon: 'help',          label: 'Explain',          desc: 'Plain-language explanations of topics',       prompt: 'Explain the key concepts from the documents in simple terms' },
  { icon: 'format_list_bulleted', label: 'Key Points', desc: 'Bullet the most critical takeaways',        prompt: 'List the key points and takeaways from the documents' },
];

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */
export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const docFilter                       = searchParams.get('doc');
  const [sessions, setSessions]         = useState<ChatSession[]>(loadSessions);
  const [activeId, setActiveId]         = useState<string | null>(null);
  const [input, setInput]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [historyOpen, setHistoryOpen]   = useState(false);
  const [isDesktop, setIsDesktop]       = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [newChatRequested, setNewChatRequested] = useState(false);
  const [copiedIdx, setCopiedIdx]       = useState<number | null>(null);
  const [shouldStickToBottom, setShouldStickToBottom] = useState(true);
  const [pendingSessionDelete, setPendingSessionDelete] = useState<ChatSession | null>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});
  
  const { data: usageData, fetchUsageIfStale, decrementRemaining } = useUsageStore();

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;
  const messages = activeSession?.messages ?? [];
  const showHistory = isDesktop || historyOpen;
  const filteredSessions = historyQuery
    ? sessions.filter((s) => s.title.toLowerCase().includes(historyQuery.toLowerCase()))
    : sessions;

  useEffect(() => { saveSessions(sessions); }, [sessions]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 640px)');
    const update = () => setIsDesktop(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    fetchUsageIfStale();
  }, [fetchUsageIfStale]);

  useEffect(() => {
    if (!isDesktop) {
      setHistoryCollapsed(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (!activeId && sessions.length > 0 && !newChatRequested) {
      setActiveId(sessions[0].id);
    }
  }, [activeId, sessions, newChatRequested]);

  useEffect(() => {
    if (shouldStickToBottom) {
      bottomRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' });
    }
  }, [messages.length, loading, shouldStickToBottom]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !activeId) return;

    const saved = scrollPositionsRef.current[activeId];
    if (typeof saved === 'number') {
      container.scrollTop = saved;
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [activeId]);

  const startNewChat = useCallback(() => {
    if (docFilter) {
      setSearchParams({});
    }
    setNewChatRequested(true);
    setActiveId(null);
    setInput('');
    setHistoryOpen(false);
    setShouldStickToBottom(true);
  }, [docFilter, setSearchParams]);

  const updateSession = useCallback((id: string, newMessages: Message[], title?: string) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], messages: newMessages, updatedAt: Date.now(), ...(title ? { title } : {}) };
      return updated;
    });
  }, []);

  const appendTokenToSession = useCallback((id: string, token: string) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const updated = [...prev];
      const session = updated[idx];
      const msgs = [...session.messages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
        const last = msgs[msgs.length - 1];
        msgs[msgs.length - 1] = { ...last, text: last.text + token };
      } else {
        msgs.push({ role: 'assistant', text: token });
      }
      updated[idx] = { ...session, messages: msgs, updatedAt: Date.now() };
      return updated;
    });
  }, []);

  const finalizeSessionMessage = useCallback((id: string, text: string, data?: ChatResponse) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const updated = [...prev];
      const session = updated[idx];
      const msgs = [...session.messages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
        msgs[msgs.length - 1] = { role: 'assistant', text, data };
      } else {
        msgs.push({ role: 'assistant', text, data });
      }
      updated[idx] = { ...session, messages: msgs, updatedAt: Date.now() };
      return updated;
    });
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
  }, [activeId]);

  const requestDeleteSession = useCallback((session: ChatSession) => {
    setPendingSessionDelete(session);
  }, []);

  const confirmDeleteSession = useCallback(() => {
    if (!pendingSessionDelete) return;
    const id = pendingSessionDelete.id;
    setPendingSessionDelete(null);
    deleteSession(id);
  }, [deleteSession, pendingSessionDelete]);

  const handleSend = async () => {
    if (usageData && usageData.remaining <= 0) return;
    const q = input.trim();
    if (!q || loading) return;
    setInput('');

    let sessionId = activeId;

    if (!sessionId) {
      const newSession: ChatSession = {
        id: generateId(),
        title: q.length > 50 ? q.slice(0, 50) + '…' : q,
        messages: [
          { role: 'user', text: q },
          { role: 'assistant', text: '' }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      sessionId = newSession.id;
      setSessions((prev) => [newSession, ...prev]);
      setActiveId(sessionId);
      setNewChatRequested(false);
    } else {
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === sessionId);
        if (idx === -1) return prev;
        const updated = [...prev];
        const session = updated[idx];
        updated[idx] = {
          ...session,
          messages: [
            ...session.messages,
            { role: 'user', text: q },
            { role: 'assistant', text: '' }
          ],
          updatedAt: Date.now(),
        };
        return updated;
      });
    }

    setLoading(true);
    setShouldStickToBottom(true);

    let streamedText = '';
    let streamCitations: Citation[] = [];

    const documentIds = docFilter ? [docFilter] : undefined;

    try {
      await chatStream(
        q,
        documentIds,
        // onToken: append token using functional updates
        (token) => {
          streamedText += token;
          appendTokenToSession(sessionId!, token);
        },
        // onCitations: store citations
        (citations) => {
          streamCitations = citations;
        },
        // onDone: finalize with citations
        () => {
          const finalAnswer = streamedText.trim().length > 0
            ? streamedText
            : 'Sorry, I could not find this information in your uploaded documents.';
          const finalData: ChatResponse = {
            answer: finalAnswer,
            citations: streamCitations,
            retrieved_chunks: [],
          };
          finalizeSessionMessage(sessionId!, finalAnswer, finalData);
          setLoading(false);
          decrementRemaining();
        },
        // onError: fall back to standard chat
        async (error) => {
          console.warn('Stream failed, falling back to standard chat:', error);
          try {
            const res = await chat(q, documentIds);
            finalizeSessionMessage(sessionId!, res.answer, res);
            decrementRemaining();
          } catch (e2: any) {
            finalizeSessionMessage(sessionId!, `Error: ${e2.message}`);
          } finally {
            setLoading(false);
          }
        },
      );
    } catch (e: any) {
      // Network-level failure — fall back to standard chat
      try {
        const res = await chat(q, documentIds);
        finalizeSessionMessage(sessionId!, res.answer, res);
        decrementRemaining();
      } catch (e2: any) {
        finalizeSessionMessage(sessionId!, `Error: ${e2.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleSuggestion = (prompt: string) => {
    setInput(prompt);
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    if (activeId) {
      scrollPositionsRef.current[activeId] = container.scrollTop;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShouldStickToBottom(distanceFromBottom < 96);
  };

  const relativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'Just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const calculateResetTime = (resetDate: string) => {
    const diffMs = new Date(resetDate).getTime() - Date.now();
    if (diffMs <= 0) return 'soon';
    const hours = Math.floor(diffMs / 3600_000);
    const minutes = Math.floor((diffMs % 3600_000) / 60_000);
    return `${hours}h ${minutes}m`;
  };

  /* ──────────────────────────────────────────── */
  return (
    <div className="flex h-full w-full min-h-0">
      <ConfirmToast
        open={Boolean(pendingSessionDelete)}
        title="Delete conversation?"
        message={pendingSessionDelete ? `"${pendingSessionDelete.title}" will be removed from your local history.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteSession}
        onCancel={() => setPendingSessionDelete(null)}
        tone="danger"
      />

      {/* ══════════ History overlay (mobile) ══════════ */}
      {historyOpen && !isDesktop && (
        <div className="fixed inset-0 bg-black/40 z-20 sm:hidden" onClick={() => setHistoryOpen(false)} />
      )}

      {/* ══════════ History Sidebar ══════════ */}
      <div className={`
        ${showHistory ? (isDesktop ? (historyCollapsed ? 'w-14' : 'w-64 sm:w-72') : 'w-64') : 'w-0'}
        transition-all duration-300 ease-out overflow-hidden flex-shrink-0
        bg-[#0c1017] border-r border-outline-variant/10
        ${showHistory && !isDesktop ? 'fixed inset-y-0 left-0 z-30' : ''}
      `}>
        <div className={`h-full flex flex-col ${historyCollapsed && isDesktop ? 'items-center' : ''}`}>
          <div className={`px-4 py-5 border-b border-outline-variant/10 flex items-center justify-between flex-shrink-0 w-full ${historyCollapsed && isDesktop ? 'px-2' : ''}`}>
            {!historyCollapsed && (
              <div className="flex flex-col">
                <h3 className="text-xs uppercase tracking-[0.24em] text-outline font-black">Conversations</h3>
                <span className="text-[10px] text-outline/60">{sessions.length} total</span>
              </div>
            )}
            <button
              onClick={() => (isDesktop ? setHistoryCollapsed((v) => !v) : setHistoryOpen(false))}
              className="p-1 hover:bg-surface-container rounded-lg transition-colors"
              title={historyCollapsed ? 'Expand history' : 'Collapse history'}
              aria-label={historyCollapsed ? 'Expand history' : 'Collapse history'}
            >
              <span className="material-symbols-outlined text-sm text-outline">
                {historyCollapsed ? 'chevron_right' : 'chevron_left'}
              </span>
            </button>
          </div>

          <div className={`px-3 pb-3 flex-shrink-0 space-y-3 ${historyCollapsed && isDesktop ? 'hidden' : ''}`}>
            <button
              onClick={startNewChat}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-container/25 border border-primary/20 rounded-xl text-xs font-bold text-primary hover:bg-primary-container/35 hover:border-primary/40 transition-all duration-300"
              aria-label="Create new conversation"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Conversation
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-container/50 rounded-xl border border-outline-variant/10">
              <span className="material-symbols-outlined text-sm text-outline">search</span>
              <input
                className="flex-1 bg-transparent text-xs text-on-surface placeholder:text-outline/50 focus:outline-none"
                placeholder="Search chats..."
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
              />
              {historyQuery && (
                <button onClick={() => setHistoryQuery('')} className="text-outline hover:text-on-surface transition-colors" aria-label="Clear search query">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto no-scrollbar px-3 pb-4 space-y-1 min-h-0 ${historyCollapsed && isDesktop ? 'px-2' : ''}`}>
            {filteredSessions.length === 0 ? (
              <p className={`px-3 py-6 text-xs text-outline text-center italic ${historyCollapsed && isDesktop ? 'hidden' : ''}`}>
                {historyQuery ? 'No matches found' : 'No conversations yet'}
              </p>
            ) : (
              filteredSessions.map((s) => (
                <div
                  key={s.id}
                  className={`w-full rounded-md transition-all duration-200 group flex items-center gap-2 ${
                    s.id === activeId
                      ? 'bg-surface-container/60 border border-outline-variant/20'
                      : 'hover:bg-surface-container/40 border border-transparent'
                  } ${historyCollapsed && isDesktop ? 'px-2 py-2' : 'px-3 py-2.5'}`}
                >
                  <button
                    onClick={() => { setActiveId(s.id); setHistoryOpen(false); setNewChatRequested(false); }}
                    className="flex-1 text-left min-w-0"
                    title={s.title}
                  >
                    {!historyCollapsed && (
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-medium text-on-surface truncate">{s.title}</p>
                        <p className="text-[10px] text-outline/60 mt-0.5">{s.messages.length} msgs · {relativeTime(s.updatedAt)}</p>
                      </div>
                    )}
                  </button>
                  {!historyCollapsed && (
                    <button
                      onClick={(e) => { e.stopPropagation(); requestDeleteSession(s); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-error/10 rounded transition-all flex-shrink-0"
                      title="Delete"
                      aria-label={`Delete conversation: ${s.title}`}
                    >
                      <span className="material-symbols-outlined text-xs text-error">delete</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ══════════ Main Chat Area ══════════ */}
      <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 relative">

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-outline-variant/10 flex-shrink-0 bg-[#0f131a]/85 backdrop-blur-md z-10 relative">
          <button
            onClick={() => (isDesktop ? setHistoryCollapsed((v) => !v) : setHistoryOpen(!historyOpen))}
            className="p-2 hover:bg-surface-container/70 rounded-xl transition-all duration-200 group"
            title="Chat History"
            aria-label="Toggle chat history sidebar"
          >
            <span className="material-symbols-outlined text-lg text-outline group-hover:text-on-surface transition-colors">history</span>
          </button>
          <button onClick={startNewChat} className="p-2 hover:bg-surface-container/70 rounded-xl transition-all duration-200 group" title="New Chat" aria-label="Start new conversation">
            <span className="material-symbols-outlined text-lg text-outline group-hover:text-on-surface transition-colors">edit_square</span>
          </button>

          <div className="ml-1 flex flex-col leading-tight">
            <span className="text-[11px] uppercase tracking-[0.2em] text-outline/70">Knowledge Chat</span>
            <span className="text-xs text-on-surface-variant font-medium truncate max-w-[160px] sm:max-w-xs">
              {activeSession ? activeSession.title : 'New conversation'}
            </span>
          </div>

          {messages.length > 0 && (
            <button onClick={startNewChat} className="ml-auto px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold text-outline hover:text-on-surface hover:bg-surface-container border border-outline-variant/15 rounded-lg transition-all duration-200 flex-shrink-0">
              Clear
            </button>
          )}
        </div>

        {/* ── Empty state: full-height flex column, input pinned to bottom ── */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col min-h-0 relative">
            {/* Grows to push input down */}
            <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center pb-28 px-3 sm:px-6 min-h-0 custom-scrollbar">
              <div className="animate-fade-in-up flex flex-col items-center w-full">
                <div className="animate-float mb-5">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/20 shadow-[0_0_30px_rgba(181,196,255,0.1)]">
                    <span className="material-symbols-outlined text-2xl sm:text-3xl text-primary/60">neurology</span>
                  </div>
                </div>

                <h3 className="font-['Space_Grotesk'] text-lg sm:text-2xl font-bold text-on-surface/80 mb-1 text-center">
                  What would you like to explore?
                </h3>
                <p className="text-xs sm:text-sm text-on-surface-variant mb-6 text-center max-w-md px-4">
                  Ask questions about your uploaded documents. I'll find relevant information and cite my sources.
                </p>

                {/* Suggestion cards — responsive grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 w-full max-w-2xl">
                  {suggestions.map((s, i) => (
                    <button
                      key={s.label}
                      onClick={() => handleSuggestion(s.prompt)}
                      className="text-left p-3 sm:p-4 bg-surface-container/50 border border-outline-variant/15 rounded-xl sm:rounded-2xl hover:bg-surface-container hover:border-primary/30 transition-all duration-300 hover-lift group animate-fade-in-up"
                      style={{ animationDelay: `${0.1 + i * 0.06}s` }}
                    >
                      <span className="material-symbols-outlined text-base sm:text-lg text-primary/50 group-hover:text-primary transition-colors duration-300 mb-1 sm:mb-2 block">{s.icon}</span>
                      <p className="text-xs font-bold text-on-surface mb-0.5">{s.label}</p>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed hidden sm:block">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Input bar — inside the empty state, pinned right below suggestions */}
            <div className="absolute left-0 right-0 bottom-0 px-3 sm:px-6 py-4 bg-gradient-to-t from-[#10141a] to-transparent z-20 w-full">
              <ChatInput input={input} setInput={setInput} loading={loading} onSend={handleSend} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 relative">
            {/* Messages area */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 pt-6 pb-[104px] min-h-0 scroll-smooth overscroll-contain flex flex-col"
            >
              <div className="max-w-4xl mx-auto w-full flex flex-col mt-auto space-y-6">

                  {/* Messages */}
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${
                        msg.role === 'user' ? 'animate-slide-in-right' : 'animate-slide-in-left'
                      } group/msg`}
                    >
                    {/* Assistant avatar */}
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mr-2 sm:mr-3 mt-1 flex-shrink-0 border border-primary/10">
                        <span className="material-symbols-outlined text-xs sm:text-sm text-primary/70">neurology</span>
                      </div>
                    )}

                    <div className="max-w-[92%] sm:max-w-[78%] lg:max-w-[70%] relative">
                      <div
                        className={`p-4 sm:p-5 rounded-2xl backdrop-blur-md transition-all duration-300 ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/25 rounded-br-md text-on-surface shadow-[0_12px_35px_-20px_rgba(181,196,255,0.35)]'
                            : 'bg-[#151b24]/85 border border-outline-variant/15 rounded-tl-md text-on-surface/90 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)]'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="text-sm leading-relaxed prose prose-invert prose-p:my-2 prose-pre:my-3 prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 max-w-none">
                            {renderMarkdown(msg.text)}
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        )}

                        {/* Citations */}
                        {msg.role === 'assistant' && msg.data && msg.data.citations && msg.data.citations.length > 0 && (
                          <div className="mt-5 pt-4 border-t border-outline-variant/10">
                            <p className="text-[10px] uppercase tracking-[0.15em] text-outline font-bold mb-3 flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[14px]">plagiarism</span>
                              Sourced From
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {msg.data.citations.map((cite, idx) => (
                                <div
                                  key={idx}
                                  className="group/cite relative cursor-pointer px-3 py-1.5 bg-primary/5 rounded-lg border border-primary/10 hover:bg-primary/15 hover:border-primary/30 transition-all duration-300"
                                >
                                  <span className="text-[11px] text-primary/80 font-medium">
                                    {cite.file_name}{cite.page ? ` · p.${cite.page}` : ''}
                                  </span>
                                  <div className="absolute bottom-full left-0 mb-2 w-72 p-4 bg-[#1a1f26] rounded-xl hidden group-hover/cite:block z-50 text-xs shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border border-outline-variant/20 animate-fade-in-down">
                                    <p className="text-[11px] text-primary font-bold mb-2 break-all">{cite.file_name}{cite.page ? ` — Page ${cite.page}` : ''}</p>
                                    <p className="text-on-surface-variant/90 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar italic">"{cite.snippet}"</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Copy button */}
                      <button
                        onClick={() => copyMessage(msg.text, i)}
                        className="absolute -bottom-3 right-3 opacity-0 group-hover/msg:opacity-100 p-1.5 bg-[#1c2330] border border-outline-variant/20 rounded-lg transition-all duration-200 hover:bg-surface-container-highest shadow-lg"
                        aria-label="Copy message"
                      >
                        <span className="material-symbols-outlined text-[14px] text-outline">
                          {copiedIdx === i ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>

                    {/* User avatar */}
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-secondary/20 to-tertiary/20 flex items-center justify-center ml-2 sm:ml-3 mt-1 flex-shrink-0 border border-secondary/10">
                        <span className="material-symbols-outlined text-xs sm:text-sm text-secondary/70">person</span>
                      </div>
                    )}
                  </div>
                  ))}

                  {/* Typing indicator */}
                  {loading && (
                    <div className="flex justify-start animate-slide-in-left">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mr-2 sm:mr-3 mt-1 flex-shrink-0 border border-primary/10">
                        <span className="material-symbols-outlined text-xs sm:text-sm text-primary/70">neurology</span>
                      </div>
                      <div className="p-4 bg-[#1c2026]/80 rounded-2xl rounded-tl-md border border-outline-variant/10 flex gap-1.5 items-center">
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce-dot animate-bounce-dot-1" />
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce-dot animate-bounce-dot-2" />
                        <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce-dot animate-bounce-dot-3" />
                      </div>
                    </div>
                  )}

                  {/* Spacer to ensure bottom scrolling clears the absolute elements */}
                  <div ref={bottomRef} className="h-0" />
              </div>
            </div>

            {/* Input bar — pinned to bottom when messages exist */}
            <div className="absolute left-0 right-0 bottom-0 px-3 sm:px-6 py-4 border-t border-outline-variant/10 bg-[#10141a]/95 backdrop-blur-xl z-20 w-full shadow-[0_-10px_30px_rgba(16,20,26,0.8)]">
              <ChatInput input={input} setInput={setInput} loading={loading} onSend={handleSend} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

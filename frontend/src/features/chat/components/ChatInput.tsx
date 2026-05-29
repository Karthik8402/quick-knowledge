import React, { useEffect, useRef } from 'react';
import { useUsageStore } from '../../../services/usage';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  onSend: () => void;
}

export default function ChatInput({ input, setInput, loading, onSend }: ChatInputProps) {
  const { data: usageData } = useUsageStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const calculateResetTime = (resetDate: string) => {
    const diffMs = new Date(resetDate).getTime() - Date.now();
    if (diffMs <= 0) return 'soon';
    const hours = Math.floor(diffMs / 3600_000);
    const minutes = Math.floor((diffMs % 3600_000) / 60_000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-[#131924]/80 backdrop-blur-xl border border-outline-variant/20 p-1.5 sm:p-2 rounded-2xl flex items-end gap-2 focus-within:border-primary/40 transition-all duration-300 shadow-xl">
        <textarea
          ref={inputRef}
          className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 text-on-surface placeholder:text-outline/50 text-sm resize-none min-h-[44px] max-h-[160px] py-2.5 px-3 custom-scrollbar overflow-y-auto"
          placeholder="Ask a question about your documents…"
          value={input}
          rows={1}
          onKeyDown={handleKeyDown}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="bg-primary text-on-primary-fixed p-2.5 rounded-xl transition-all duration-200 hover:shadow-[0_0_16px_rgba(181,196,255,0.4)] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          onClick={onSend}
          disabled={loading || !input.trim() || (usageData ? usageData.remaining <= 0 : false)}
          aria-label={loading ? 'Sending message...' : 'Send message'}
        >
          <span className="material-symbols-outlined text-lg">{loading ? 'hourglass_top' : 'arrow_upward'}</span>
        </button>
      </div>
      {usageData && (
        <div className="flex justify-between items-center mt-2 mx-2">
          <p className={`text-[10px] font-bold ${usageData.remaining === 0 ? 'text-error' : usageData.remaining <= 5 ? 'text-error/80' : usageData.remaining <= 10 ? 'text-[var(--md-sys-color-tertiary)]' : 'text-primary/70'}`}>
            {usageData.remaining === 0 ? 'Daily limit reached' : usageData.remaining <= 5 ? 'Only a few requests left' : usageData.remaining <= 10 ? 'Approaching usage limit' : 'AI Usage'}
          </p>
          <div className="flex items-center gap-4 text-[10px] text-outline/60">
            <span>{usageData.remaining} / {usageData.limit} remaining</span>
            <span>Resets in: {calculateResetTime(usageData.reset_at)}</span>
            <span className="hidden sm:inline">Plan: {usageData.plan}</span>
          </div>
        </div>
      )}
      {usageData && usageData.remaining === 0 && (
        <p className="text-xs text-error mt-2 text-center bg-error/10 p-2 rounded-lg border border-error/20">
          You reached your daily AI limit. Please wait until the next reset.
        </p>
      )}
      <p className="text-[10px] text-outline/40 text-center mt-2 hidden sm:block">
        Press Enter to send · Shift+Enter for new line · Responses are grounded in your uploaded documents
      </p>
    </div>
  );
}

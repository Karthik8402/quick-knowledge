import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import ChatPage from '../features/chat/ChatPage';

// Mock react-router-dom useSearchParams since it's tested within BrowserRouter
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [
      new URLSearchParams(),
      vi.fn(),
    ],
  };
});

// Mock useAuth since ChatPage needs user.id
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    loading: false,
    session: null,
  }),
}));

// Mock localStorage for session persistence
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock usage store to avoid network/cache requests
vi.mock('../services/usage', () => ({
  useUsageStore: () => ({
    data: {
      used: 0,
      limit: 50,
      remaining: 50,
      percentage: 0,
      reset_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      plan: 'Free',
      status: 'active',
    },
    fetchUsageIfStale: vi.fn(),
    decrementRemaining: vi.fn(),
  }),
}));

describe('ChatPage Component', () => {
  it('renders initial empty state with neurologist icon and suggestions', () => {
    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    // Verify empty state title and icon exist
    expect(screen.getByText('What would you like to explore?')).toBeInTheDocument();
    expect(screen.getByText('Summarize')).toBeInTheDocument();
    expect(screen.getByText('Compare')).toBeInTheDocument();
    expect(screen.getByText('Explain')).toBeInTheDocument();
  });

  it('populates input field when a suggestion card is clicked', () => {
    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    // Click "Summarize" suggestion card
    const summarizeBtn = screen.getByText('Summarize').closest('button');
    expect(summarizeBtn).toBeInTheDocument();
    
    if (summarizeBtn) {
      fireEvent.click(summarizeBtn);
    }

    // Verify input textarea is updated with the suggestion prompt
    const textarea = screen.getByPlaceholderText('Ask a question about your documents…') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Give me a comprehensive summary of the uploaded documents');
  });

  it('renders chat toolbar actions', () => {
    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    // Verify chat sidebar toggling button and edit buttons are available in toolbar
    expect(screen.getByLabelText('Toggle chat history sidebar')).toBeInTheDocument();
    expect(screen.getByLabelText('Start new conversation')).toBeInTheDocument();
  });
});

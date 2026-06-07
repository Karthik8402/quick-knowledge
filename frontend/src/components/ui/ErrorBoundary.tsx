import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React ErrorBoundary — catches render errors in the component tree and
 * shows a styled fallback UI instead of a blank / crashed page.
 *
 * Must be a class component — React hooks cannot catch render-phase errors.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console — replace with a real error-reporting service (Sentry etc.)
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #09090b 0%, #111113 100%)',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '2rem',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '2.5rem',
              textAlign: 'center',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(239,68,68,0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2
              style={{
                color: '#f4f4f5',
                fontSize: '1.25rem',
                fontWeight: 600,
                margin: '0 0 0.75rem',
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                color: '#71717a',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                margin: '0 0 1.75rem',
              }}
            >
              An unexpected error occurred in this part of the app. You can try
              recovering below or reload the page.
            </p>

            {/* Error details (collapsed) */}
            {this.state.error && (
              <details
                style={{
                  textAlign: 'left',
                  marginBottom: '1.5rem',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <summary
                  style={{
                    color: '#a1a1aa',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  Error details
                </summary>
                <pre
                  style={{
                    color: '#ef4444',
                    fontSize: '0.7rem',
                    marginTop: '0.5rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                id="error-boundary-retry-btn"
                onClick={this.handleReset}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(99,102,241,0.5)',
                  background: 'rgba(99,102,241,0.15)',
                  color: '#a5b4fc',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'rgba(99,102,241,0.3)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = 'rgba(99,102,241,0.15)';
                }}
              >
                Try again
              </button>
              <button
                id="error-boundary-reload-btn"
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: '#71717a',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.color = '#a1a1aa';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.color = '#71717a';
                }}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

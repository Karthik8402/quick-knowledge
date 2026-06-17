import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSessions, revokeSession, revokeAllOtherSessions } from '../api';
import type { SessionInfo } from '../types';
import { showToast } from '../shared/Toast';

export default function SessionsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [revokingIds, setRevokingIds] = useState<string[]>([]);
  const [revokedIds, setRevokedIds] = useState<string[]>([]);
  const [revokingAll, setRevokingAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const data = await getSessions();
      setSessions(data.sessions);
      setNote(data.note || '');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void fetchSessions();
    }
  }, [user]);

  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingIds(prev => [...prev, sessionId]);
    setErrorMsg(null);
    try {
      await revokeSession(sessionId);
      // Start fade out
      setRevokedIds(prev => [...prev, sessionId]);
      // Remove from list after animation (300ms)
      setTimeout(() => {
        setSessions(prev => prev.filter(s => s.session_id !== sessionId));
        setRevokingIds(prev => prev.filter(id => id !== sessionId));
        setRevokedIds(prev => prev.filter(id => id !== sessionId));
      }, 300);
      showToast('success', 'Session Revoked', 'The selected session has been ended.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to revoke session: ${err.message || err}`);
      setRevokingIds(prev => prev.filter(id => id !== sessionId));
    }
  };

  const handleRevokeAllOthers = async () => {
    setRevokingAll(true);
    setErrorMsg(null);
    try {
      await revokeAllOtherSessions();
      const current = sessions.find(s => s.is_current);
      const otherIds = sessions.filter(s => !s.is_current).map(s => s.session_id);
      
      // Start fade out for other sessions
      setRevokedIds(prev => [...prev, ...otherIds]);
      setTimeout(() => {
        setSessions(current ? [current] : []);
        setRevokedIds([]);
      }, 300);
      showToast('success', 'Sessions Revoked', 'All other sessions have been ended.');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Failed to revoke other sessions: ${err.message || err}`);
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (deviceStr: string) => {
    const lower = deviceStr.toLowerCase();
    if (lower.includes('phone') || lower.includes('android') || lower.includes('iphone')) {
      return 'phone_android';
    }
    if (lower.includes('ipad') || lower.includes('tablet')) {
      return 'tablet_mac';
    }
    return 'computer';
  };

  if (!user) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in-up">
        <div>
          <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">Sessions</h3>
        </div>
        <div className="bg-surface-container/40 border border-outline-variant/15 p-8 rounded-2xl text-center">
          <span className="material-symbols-outlined text-4xl text-outline/30 mb-3 block">lock</span>
          <p className="text-sm text-on-surface-variant">Sign in to view your active sessions.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in-up">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-outline font-black">Security</p>
          <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">Sessions</h3>
          <p className="text-on-surface-variant text-sm mt-1">Manage your active sessions and sign-in history.</p>
        </div>
        <div className="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl space-y-4">
          <div className="skeleton w-1/3 h-5 rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(n => <div key={n} className="skeleton h-12 rounded-xl" />)}
          </div>
        </div>
        <div className="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl space-y-4">
          <div className="skeleton w-1/4 h-5 rounded-lg" />
          <div className="space-y-3">
            {[1, 2, 3].map(n => <div key={n} className="skeleton h-16 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.is_current);
  const otherSessions = sessions.filter(s => !s.is_current);

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-outline font-black">Security</p>
        <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">Sessions</h3>
        <p className="text-on-surface-variant text-sm mt-1">Manage your active sessions and sign-in history.</p>
      </div>

      {errorMsg && (
        <div className="bg-error/10 border border-error/20 text-error text-xs p-3.5 rounded-xl flex items-center gap-2 mb-2 animate-shake">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Current Session */}
      {currentSession && (
        <div className="bg-surface-container/40 border border-primary/25 p-5 sm:p-6 rounded-2xl backdrop-blur-xl animate-scale-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-headline font-bold text-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-primary/60">shield</span>
              Current Session
            </h4>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-400/10 text-green-400">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Active
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoBlock icon={getDeviceIcon(currentSession.device)} label="Device" value={currentSession.device} />
            <InfoBlock icon="schedule" label="Last Seen" value={currentSession.last_seen_at ? formatTimeAgo(currentSession.last_seen_at) : 'Just now'} />
            <InfoBlock icon="person" label="Account" value={user.email || 'Unknown'} />
            <InfoBlock icon="language" label="IP Address" value={currentSession.ip} />
          </div>
        </div>
      )}

      {/* Session History */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-headline font-bold text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary/60">history</span>
            Session History
          </h4>
          {otherSessions.length > 0 && (
            <button
              onClick={handleRevokeAllOthers}
              disabled={revokingAll}
              className="text-xs text-error hover:text-error/80 hover:bg-error/10 font-bold px-3 py-1.5 rounded-xl border border-error/20 transition-all duration-300 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {revokingAll ? (
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-sm">logout</span>
              )}
              Revoke All Others
            </button>
          )}
        </div>
        
        {otherSessions.length === 0 ? (
          <div className="text-center py-6 text-xs text-on-surface-variant italic">
            No other active sessions detected.
          </div>
        ) : (
          <div className="space-y-3">
            {otherSessions.map((session, i) => {
              const isRevoking = revokingIds.includes(session.session_id);
              const isRevoked = revokedIds.includes(session.session_id);

              return (
                <div
                  key={session.session_id}
                  className={`flex items-center justify-between p-4 rounded-xl border bg-surface-container-highest/30 border-outline-variant/10 hover:bg-surface-container-highest/50 transition-all duration-300 ${
                    isRevoked ? 'opacity-0 max-h-0 py-0 border-0 overflow-hidden scale-95' : ''
                  }`}
                  style={{ 
                    animationDelay: `${i * 0.05}s`,
                    maxHeight: isRevoked ? '0px' : '100px'
                  }}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-on-surface-variant">{getDeviceIcon(session.device)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-on-surface flex items-center gap-2">
                        {session.device}
                      </p>
                      <p className="text-[11px] text-on-surface-variant">
                        IP: {session.ip} · Last active {formatTimeAgo(session.last_seen_at)}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleRevokeSession(session.session_id)}
                    disabled={isRevoking}
                    className="text-xs text-error hover:text-error/80 font-medium px-3 py-1.5 rounded-lg hover:bg-error/10 transition-colors flex-shrink-0 flex items-center gap-1"
                  >
                    {isRevoking && (
                      <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                    )}
                    {isRevoking ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-surface-container-low border border-outline-variant/10 p-4 sm:p-6 rounded-xl sm:rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary/60 text-lg mt-0.5 flex-shrink-0">info</span>
          <div className="text-xs text-on-surface-variant leading-relaxed space-y-1">
            <p><strong className="text-on-surface">Security Note:</strong> {note || 'Active sessions represent open connections to your account.'}</p>
            <p>If you see any suspicious activity, immediately revoke that session and update your password.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-outline font-bold mb-1 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-xs text-primary/50">{icon}</span>
        {label}
      </p>
      <p className="text-sm text-on-surface font-medium truncate">{value}</p>
    </div>
  );
}

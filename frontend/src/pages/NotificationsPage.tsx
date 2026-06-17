import { useState } from 'react';
import { useAppData } from '../hooks/useAppData';
import type { NotificationItem } from '../types';

type FilterTab = 'all' | 'critical' | 'warning' | 'info';

export default function NotificationsPage() {
  const { notifications: notificationsData, loading } = useAppData();
  const notifications: NotificationItem[] = notificationsData?.notifications || [];
  const [readIds, setReadIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ik-dismissed-notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const handleDismiss = (id: string) => {
    const target = notifications.find(n => n.id === id);
    if (target && target.dismissible === false) {
      return;
    }
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      localStorage.setItem('ik-dismissed-notifications', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleRead = (id: string) => {
    setReadIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const markAllRead = () => {
    const visibleIds = visibleNotifications.map(n => n.id);
    setReadIds(visibleIds);
  };

  // Filter out dismissed notifications, but KEEP non-dismissible ones no matter what
  const visibleNotifications = notifications.filter(n => 
    n.dismissible === false ? true : !dismissedIds.includes(n.id)
  );

  // Apply tab filter
  const filtered = activeFilter === 'all'
    ? visibleNotifications
    : visibleNotifications.filter(n => n.type === activeFilter);

  // Sort: unread first, then by timestamp descending
  const sorted = [...filtered].sort((a, b) => {
    const aRead = readIds.includes(a.id);
    const bRead = readIds.includes(b.id);
    if (aRead !== bRead) {
      return aRead ? 1 : -1;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const unreadCount = visibleNotifications.filter(n => !readIds.includes(n.id)).length;

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'warning', label: 'Warning' },
    { key: 'info', label: 'Info' },
  ];

  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'text-error';
      case 'warning':
        return 'text-tertiary';
      case 'info':
      default:
        return 'text-primary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-outline font-black">Inbox</p>
          <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h3>
          <p className="text-on-surface-variant text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="bg-surface-container/60 border border-outline-variant/15 px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all duration-300 flex items-center gap-2 self-start"
          >
            <span className="material-symbols-outlined text-sm">done_all</span>
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap ${
              activeFilter === f.key
                ? 'bg-primary text-on-primary-fixed'
                : 'bg-surface-container/60 text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-outline-variant/10'
            }`}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1.5 text-[10px] opacity-70 font-bold">
                {visibleNotifications.filter(n => n.type === f.key).filter(n => !readIds.includes(n.id)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {sorted.length === 0 ? (
        <div className="bg-surface-container/40 border border-outline-variant/15 p-8 rounded-2xl text-center animate-scale-in">
          <span className="material-symbols-outlined text-5xl text-outline/20 mb-3 block">notifications_off</span>
          <p className="text-on-surface font-bold mb-1">No notifications</p>
          <p className="text-sm text-on-surface-variant">You're all caught up. New notifications will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((notification, i) => {
            const isRead = readIds.includes(notification.id);
            return (
              <div
                key={notification.id}
                onClick={() => toggleRead(notification.id)}
                className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 animate-fade-in-up ${
                  isRead
                    ? 'bg-surface-container/20 border-outline-variant/10 hover:bg-surface-container/40'
                    : 'bg-surface-container/40 border-primary/15 hover:bg-surface-container/60'
                }`}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                {/* Unread dot */}
                <div className="flex-shrink-0 pt-1.5">
                  <div className={`w-2 h-2 rounded-full transition-colors ${isRead ? 'bg-transparent' : 'bg-primary'}`} />
                </div>

                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0 border border-outline-variant/10">
                  <span className={`material-symbols-outlined text-lg ${getIconColor(notification.type)}`}>
                    {notification.icon}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isRead ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{notification.body}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-outline">{formatTimeAgo(notification.timestamp)}</span>
                    {notification.action && (
                      <a
                        href={notification.action.href}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-bold text-primary hover:underline"
                      >
                        {notification.action.label}
                      </a>
                    )}
                  </div>
                </div>

                {/* Close Button (if dismissible) */}
                {notification.dismissible !== false && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(notification.id);
                    }}
                    className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container transition-colors flex-shrink-0"
                    title="Dismiss"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

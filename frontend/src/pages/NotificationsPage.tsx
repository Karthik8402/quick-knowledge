import { useEffect, useState } from 'react';
import { getSystemStatus } from '../api';
import { useUsageStore } from '../services/usage';
import type { SystemStatus } from '../types';

type NotificationType = 'system' | 'documents' | 'alerts';

type Notification = {
  id: string;
  type: NotificationType;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
};

type FilterTab = 'all' | NotificationType;

const STATIC_SEEDS = [
  {
    id: 'n1',
    type: 'system' as const,
    icon: 'system_update',
    iconColor: 'text-primary',
    title: 'System Updated',
    description: 'Quick Knowledge has been updated to the latest version with performance improvements.',
    timestamp: new Date(Date.now() - 1800000),
  },
  {
    id: 'n2',
    type: 'documents' as const,
    icon: 'check_circle',
    iconColor: 'text-green-400',
    title: 'Document Processing Complete',
    description: 'Your uploaded document has been successfully chunked and indexed into the vector store.',
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: 'n4',
    type: 'system' as const,
    icon: 'waving_hand',
    iconColor: 'text-secondary',
    title: 'Welcome to Quick Knowledge',
    description: 'Get started by uploading documents and chatting with your knowledge base.',
    timestamp: new Date(Date.now() - 86400000),
  },
  {
    id: 'n5',
    type: 'documents' as const,
    icon: 'auto_awesome',
    iconColor: 'text-primary',
    title: 'Embeddings Generated',
    description: 'Vector embeddings have been generated for all your uploaded documents.',
    timestamp: new Date(Date.now() - 172800000),
  },
  {
    id: 'n6',
    type: 'alerts' as const,
    icon: 'security',
    iconColor: 'text-error',
    title: 'Security Notice',
    description: 'A new sign-in was detected from an unrecognized device. If this was you, no action is needed.',
    timestamp: new Date(Date.now() - 259200000),
  },
];

export default function NotificationsPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [readIds, setReadIds] = useState<string[]>(['n4', 'n5', 'n6']);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const { data: usageData, fetchUsageIfStale } = useUsageStore();

  useEffect(() => {
    fetchUsageIfStale();
    getSystemStatus().then(setStatus).catch(() => null);
  }, [fetchUsageIfStale]);

  // Dynamically build notifications list
  const notifications: Notification[] = [];

  // 1. Vector Store check
  if (status && !status.store_initialized) {
    notifications.push({
      id: 'n-sys-not-configured',
      type: 'alerts',
      icon: 'error',
      iconColor: 'text-error',
      title: 'System not configured',
      description: 'The vector store is not initialized. Please verify configuration or initialize the DB in Settings.',
      timestamp: new Date(),
      read: readIds.includes('n-sys-not-configured'),
    });
  }

  // 2. High Usage check
  if (usageData && usageData.percentage > 80) {
    notifications.push({
      id: 'n-usage-limit-warning',
      type: 'alerts',
      icon: 'warning',
      iconColor: 'text-tertiary',
      title: 'Usage limit warning',
      description: `You have consumed ${usageData.percentage}% of your daily AI limits. Free plan resets in 24 hours.`,
      timestamp: new Date(),
      read: readIds.includes('n-usage-limit-warning'),
    });
  }

  // 3. Add static seeds
  STATIC_SEEDS.forEach(seed => {
    notifications.push({
      ...seed,
      read: readIds.includes(seed.id),
    });
  });

  // Sort: unread first, then by timestamp descending
  notifications.sort((a, b) => {
    if (a.read !== b.read) {
      return a.read ? 1 : -1;
    }
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(allIds);
  };

  const toggleRead = (id: string) => {
    setReadIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filtered = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => n.type === activeFilter);

  const filters: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'system', label: 'System' },
    { key: 'documents', label: 'Documents' },
    { key: 'alerts', label: 'Alerts' },
  ];

  const formatTimeAgo = (date: Date): string => {
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
                {notifications.filter(n => f.key === 'all' || n.type === f.key).filter(n => !n.read).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {filtered.length === 0 ? (
        <div className="bg-surface-container/40 border border-outline-variant/15 p-8 rounded-2xl text-center animate-scale-in">
          <span className="material-symbols-outlined text-5xl text-outline/20 mb-3 block">notifications_off</span>
          <p className="text-on-surface font-bold mb-1">No notifications</p>
          <p className="text-sm text-on-surface-variant">You're all caught up. New notifications will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notification, i) => (
            <div
              key={notification.id}
              onClick={() => toggleRead(notification.id)}
              className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 animate-fade-in-up ${
                notification.read
                  ? 'bg-surface-container/20 border-outline-variant/10 hover:bg-surface-container/40'
                  : 'bg-surface-container/40 border-primary/15 hover:bg-surface-container/60'
              }`}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              {/* Unread dot */}
              <div className="flex-shrink-0 pt-1.5">
                <div className={`w-2 h-2 rounded-full transition-colors ${notification.read ? 'bg-transparent' : 'bg-primary'}`} />
              </div>

              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0 border border-outline-variant/10">
                <span className={`material-symbols-outlined text-lg ${notification.iconColor}`}>{notification.icon}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${notification.read ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                  {notification.title}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{notification.description}</p>
                <p className="text-[10px] text-outline mt-1.5">{formatTimeAgo(notification.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { getActivityFeed } from '../api';

type ActivityEntry = {
  id: string;
  icon: string;
  iconColor: string;
  action: string;
  detail: string;
  timestamp: Date;
  category: 'documents' | 'chat' | 'settings';
};

type FilterTab = 'all' | 'documents' | 'chat' | 'settings';

export default function ActivityPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const fetchActivity = () => {
    setLoading(true);
    getActivityFeed(20)
      .then(res => setEvents(res.events || []))
      .catch((err) => {
        console.error(err);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  // Map API events directly to UI entries
  const activities: ActivityEntry[] = events.map((e) => ({
    id: e.document_id || Math.random().toString(),
    icon: e.icon || 'upload_file',
    iconColor: 'text-primary',
    action: e.title,
    detail: e.description,
    timestamp: new Date(e.timestamp),
    category: 'documents' as const, // currently backend only returns document uploads
  })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const filteredActivities = activeFilter === 'all'
    ? activities
    : activities.filter(a => a.category === activeFilter);

  const filters: { key: FilterTab; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'list' },
    { key: 'documents', label: 'Documents', icon: 'description' },
    { key: 'chat', label: 'Chat', icon: 'chat' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
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
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-outline font-black">Timeline</p>
        <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">Activity Feed</h3>
        <p className="text-on-surface-variant text-sm mt-1">Real-time trace of actions across your knowledge base.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap ${
              activeFilter === f.key
                ? 'bg-primary text-on-primary-fixed'
                : 'bg-surface-container/60 text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-outline-variant/10'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{f.icon}</span>
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-4">
                <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1">
                  <div className="skeleton w-40 h-3 mb-2" />
                  <div className="skeleton w-full h-4 mb-1" />
                  <div className="skeleton w-20 h-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-outline/30 mb-3 block">timeline</span>
            <p className="text-sm text-on-surface-variant">No activity found for this filter.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-outline-variant/20" />

            <div className="space-y-1">
              {filteredActivities.map((entry, i) => (
                <div
                  key={entry.id}
                  className="relative flex gap-4 pl-2 py-3 hover:bg-surface-container-highest/20 rounded-xl transition-colors animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  {/* Icon node */}
                  <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0 z-10 border border-outline-variant/10">
                    <span className={`material-symbols-outlined text-sm ${entry.iconColor}`}>{entry.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">{entry.action}</p>
                    <p className="text-xs text-on-surface-variant truncate">{entry.detail}</p>
                    <p className="text-[10px] text-outline mt-1">{formatTimeAgo(entry.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

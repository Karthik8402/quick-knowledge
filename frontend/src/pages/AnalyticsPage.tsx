import { useEffect, useState } from 'react';
import { getAnalyticsOverview } from '../api';
import { useTheme } from '../hooks/useTheme';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  const fetchOverview = () => {
    setLoading(true);
    setError(null);
    getAnalyticsOverview()
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to fetch analytics');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in-up">
        {/* Header */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-outline font-black">Intelligence</p>
          <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">Analytics Overview</h3>
          <p className="text-on-surface-variant text-sm mt-1">Loading intelligence data...</p>
        </div>

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-surface-container/40 border border-outline-variant/15 p-4 sm:p-5 rounded-2xl animate-pulse">
              <div className="h-3 w-16 bg-surface-container-highest rounded mb-2" />
              <div className="h-6 w-24 bg-surface-container-highest rounded" />
            </div>
          ))}
        </div>

        {/* Timeline Chart Skeleton */}
        <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl animate-pulse">
          <div className="h-4 w-48 bg-surface-container-highest rounded mb-4" />
          <div className="h-32 bg-surface-container-highest/20 rounded" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Distribution Skeleton */}
          <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl animate-pulse">
            <div className="h-4 w-40 bg-surface-container-highest rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-surface-container-highest/50 rounded" />)}
            </div>
          </div>
          {/* Breakdown Skeleton */}
          <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl animate-pulse">
            <div className="h-4 w-40 bg-surface-container-highest rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-surface-container-highest/50 rounded" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
        <span className="material-symbols-outlined text-5xl text-error mb-4">error</span>
        <h3 className="text-lg font-bold text-on-surface mb-2">Failed to load analytics</h3>
        <p className="text-sm text-on-surface-variant max-w-sm mb-6">{error}</p>
        <button
          onClick={fetchOverview}
          className="bg-primary text-on-primary-fixed px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 active:scale-95"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Donut Gradient Calculation
  const sourceTypes = Object.entries(data.source_type_breakdown || {});
  const totalBreakdown = sourceTypes.reduce((acc, [_, count]) => acc + (count as number), 0);

  let currentPercent = 0;
  const colors = [
    'var(--color-primary)',
    'var(--color-secondary)',
    'var(--color-tertiary)',
    'var(--color-error)',
    'var(--color-outline)'
  ];
  
  const gradientParts = sourceTypes.map(([type, count], index) => {
    const start = currentPercent;
    const percent = totalBreakdown > 0 ? ((count as number) / totalBreakdown) * 100 : 0;
    currentPercent += percent;
    const color = colors[index % colors.length];
    return `${color} ${start}% ${currentPercent}%`;
  });

  const donutGradient = totalBreakdown > 0
    ? `conic-gradient(${gradientParts.join(', ')})`
    : 'var(--color-outline-variant)';

  // Max counts for charts scaling
  const maxTimelineCount = Math.max(...data.upload_timeline.map((t: any) => t.count), 1);
  const maxDocChunks = Math.max(...data.top_documents.map((d: any) => d.chunks), 1);
  const maxBucketCount = Math.max(...Object.values(data.chunk_distribution).map((v: any) => Number(v)), 1);

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-outline font-black">Intelligence</p>
        <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h3>
        <p className="text-on-surface-variant text-sm mt-1">Deep insights into your knowledge base statistics and system utilization.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-surface-container/40 border border-outline-variant/15 p-4 sm:p-5 rounded-2xl backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-base text-primary/60">description</span>
            <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Total Documents</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-on-surface font-headline tracking-tight">{data.total_documents}</p>
        </div>

        <div className="bg-surface-container/40 border border-outline-variant/15 p-4 sm:p-5 rounded-2xl backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-base text-secondary/60">segment</span>
            <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Total Chunks</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-on-surface font-headline tracking-tight">{data.total_chunks}</p>
        </div>

        <div className="bg-surface-container/40 border border-outline-variant/15 p-4 sm:p-5 rounded-2xl backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-base text-tertiary/60">analytics</span>
            <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Avg Chunks/Doc</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-on-surface font-headline tracking-tight">{data.avg_chunks_per_doc}</p>
        </div>

        {/* AI Usage stats */}
        <div className="bg-surface-container/40 border border-outline-variant/15 p-4 sm:p-5 rounded-2xl backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary/60">smart_toy</span>
              <span className="text-[10px] uppercase tracking-widest text-outline font-bold">AI Usage</span>
            </div>
            <span className="text-[9px] uppercase font-bold text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">{data.usage.plan}</span>
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xl sm:text-2xl font-bold text-on-surface font-headline tracking-tight">{data.usage.used} / {data.usage.limit}</span>
              <span className="text-[10px] text-outline">{data.usage.percentage}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest/60 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${data.usage.percentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upload Timeline Chart */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl">
        <h4 className="font-headline font-bold text-base text-on-surface mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary/60">timeline</span>
          Upload Timeline (Last 30 Days)
        </h4>

        {data.upload_timeline.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-outline/50 text-xs italic">
            No upload activity recorded in the last 30 days
          </div>
        ) : (
          <div>
            {/* The flex bar container */}
            <div className="flex items-end justify-between h-40 gap-[3px] pt-4 px-1 border-b border-outline-variant/20 relative">
              {data.upload_timeline.map((t: any, idx: number) => {
                const heightPercent = (t.count / maxTimelineCount) * 100;
                const isZero = t.count === 0;
                return (
                  <div key={t.date} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    {/* CSS Hover Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-30 bg-surface-container-high border border-outline-variant/30 px-2.5 py-1.5 rounded-xl shadow-xl text-[10px] text-on-surface text-center whitespace-nowrap pointer-events-none transition-all duration-200">
                      <p className="font-bold text-primary">{t.count} upload{t.count !== 1 ? 's' : ''}</p>
                      <p className="text-outline text-[9px] mt-0.5">{new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>

                    {/* Bar */}
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-700 ease-out-expo ${
                        isZero 
                          ? 'bg-outline-variant/20 hover:bg-outline-variant/40' 
                          : 'bg-primary/80 hover:bg-primary'
                      }`}
                      style={{ height: isZero ? '2px' : `${heightPercent}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-Axis Labels (every 7th date) */}
            <div className="flex justify-between mt-2.5 text-[9px] text-outline font-mono px-1">
              {data.upload_timeline.map((t: any, idx: number) => {
                const shouldShowLabel = idx % 7 === 0 || idx === data.upload_timeline.length - 1;
                return (
                  <span key={t.date} className={`w-0 text-center relative ${shouldShowLabel ? 'opacity-100' : 'opacity-0'}`}>
                    {shouldShowLabel && (
                      <span className="absolute -translate-x-1/2 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chunk Distribution Horizontal Chart */}
        <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl">
          <h4 className="font-headline font-bold text-base text-on-surface mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary/60">bar_chart</span>
            Chunk Size Distribution
          </h4>
          <div className="space-y-4">
            {Object.entries(data.chunk_distribution).map(([bucket, count]: [string, any]) => {
              const widthPercent = maxBucketCount > 0 ? (count / maxBucketCount) * 100 : 0;
              return (
                <div key={bucket} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-outline font-medium font-mono">{bucket}</span>
                  <div className="flex-grow h-3 bg-surface-container-highest/40 rounded-full overflow-hidden border border-outline-variant/10">
                    <div 
                      className="h-full bg-secondary/70 rounded-full transition-all duration-700 ease-out-expo"
                      style={{ width: count > 0 ? `${widthPercent}%` : '0%' }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-bold font-mono text-on-surface-variant">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Source Type Breakdown Conic Gradient Donut */}
        <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl">
          <h4 className="font-headline font-bold text-base text-on-surface mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary/60">donut_large</span>
            Source Type Breakdown
          </h4>
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
            {/* Donut graphic */}
            <div 
              className="relative w-36 h-36 rounded-full flex items-center justify-center border border-outline-variant/10 shadow-sm flex-shrink-0"
              style={{ background: donutGradient }}
            >
              <div className="w-24 h-24 rounded-full bg-surface-container-lowest border border-outline-variant/10 flex flex-col items-center justify-center">
                <span className="text-xl font-bold font-headline text-on-surface">{totalBreakdown}</span>
                <span className="text-[9px] uppercase tracking-wider text-outline">Sources</span>
              </div>
            </div>

            {/* Legend list */}
            <div className="flex-grow space-y-2">
              {sourceTypes.length === 0 ? (
                <p className="text-xs text-outline italic">No sources imported</p>
              ) : (
                sourceTypes.map(([type, count]: [string, any], index) => {
                  const percent = totalBreakdown > 0 ? Math.round((count / totalBreakdown) * 100) : 0;
                  const color = colors[index % colors.length];
                  return (
                    <div key={type} className="flex items-center justify-between text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-on-surface-variant capitalize">{type}</span>
                      </div>
                      <span className="text-outline font-mono font-bold">{count} ({percent}%)</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Documents by Chunks */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl">
        <h4 className="font-headline font-bold text-base text-on-surface mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary/60">list</span>
          Top Documents by Chunk Count
        </h4>

        {data.top_documents.length === 0 ? (
          <div className="py-8 text-center text-outline/50 text-xs italic">
            No documents uploaded yet
          </div>
        ) : (
          <div className="space-y-4">
            {data.top_documents.map((doc: any, idx: number) => {
              const widthPercent = (doc.chunks / maxDocChunks) * 100;
              return (
                <div key={doc.document_id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-on-surface truncate max-w-[80%] flex items-center gap-2" title={doc.file_name}>
                      <span className="text-[10px] font-mono text-outline bg-surface-container-highest px-1.5 py-0.5 rounded">#{idx + 1}</span>
                      {doc.file_name}
                    </span>
                    <span className="font-mono text-on-surface-variant font-bold">{doc.chunks} chunks · {doc.pages} pages</span>
                  </div>
                  <div className="w-full h-2.5 bg-surface-container-highest/40 rounded-full overflow-hidden border border-outline-variant/5">
                    <div 
                      className="h-full bg-primary/80 rounded-full transition-all duration-700 ease-out-expo"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

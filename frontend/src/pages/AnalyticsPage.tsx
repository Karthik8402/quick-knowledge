import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { getAnalyticsOverview } from '../api';
import { useTheme } from '../hooks/useTheme';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Interactive chart state
  const [hoveredTimelineIdx, setHoveredTimelineIdx] = useState<number | null>(null);
  const [hoveredDonutIdx, setHoveredDonutIdx] = useState<number | null>(null);
  
  const timelineSvgRef = useRef<SVGSVGElement | null>(null);
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

  // Donut Graph Calculation
  const sourceTypes = Object.entries(data.source_type_breakdown || {});
  const totalBreakdown = sourceTypes.reduce((acc, [_, count]) => acc + (count as number), 0);

  const colors = [
    '#4361EE', // Primary
    '#7209B7', // Secondary
    '#F78F00', // Tertiary
    '#BA1A1A', // Error
    '#6B6B8A', // Outline
  ];

  // Donut slices coordinates using SVG strokeDasharray (r=50, circumference=314.16)
  const donutRadius = 50;
  const donutCircumference = 2 * Math.PI * donutRadius; // ~314.159
  let cumulativePercent = 0;
  
  const donutSlices = sourceTypes.map(([type, count], index) => {
    const value = count as number;
    const percent = totalBreakdown > 0 ? (value / totalBreakdown) * 100 : 0;
    const strokeOffset = donutCircumference - (percent / 100) * donutCircumference;
    const rotation = (cumulativePercent / 100) * 360;
    cumulativePercent += percent;
    return {
      type,
      value,
      percent,
      strokeOffset,
      rotation,
      color: colors[index % colors.length]
    };
  });

  // Upload Timeline Math (SVG line plotting)
  const maxTimelineCount = Math.max(...data.upload_timeline.map((t: any) => t.count), 1);
  const maxDocChunks = Math.max(...data.top_documents.map((d: any) => d.chunks), 1);
  const maxBucketCount = Math.max(...Object.values(data.chunk_distribution).map((v: any) => Number(v)), 1);

  // SVG dimensions for timeline
  const svgWidth = 800;
  const svgHeight = 200;
  const paddingX = 40;
  const paddingY = 20;

  const timelinePoints = data.upload_timeline.map((t: any, idx: number) => {
    const x = paddingX + (idx / (data.upload_timeline.length - 1)) * (svgWidth - 2 * paddingX);
    const y = (svgHeight - paddingY) - (t.count / maxTimelineCount) * (svgHeight - 2 * paddingY);
    return { x, y, count: t.count, date: t.date };
  });

  const linePathD = timelinePoints.reduce((acc: string, p: any, idx: number) => {
    return acc + `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
  }, '');

  const areaPathD = linePathD
    ? `${linePathD} L ${timelinePoints[timelinePoints.length - 1].x} ${svgHeight - paddingY} L ${timelinePoints[0].x} ${svgHeight - paddingY} Z`
    : '';

  // Handle timeline mouse move to track closest point
  const handleTimelineMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!timelineSvgRef.current || timelinePoints.length === 0) return;
    const rect = timelineSvgRef.current.getBoundingClientRect();
    // Translate client mouse X coordinates to SVG viewbox coordinates
    const scaleX = svgWidth / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;

    let closestIdx = 0;
    let minDiff = Infinity;
    timelinePoints.forEach((p: any, idx: number) => {
      const diff = Math.abs(p.x - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setHoveredTimelineIdx(closestIdx);
  };

  const handleTimelineMouseLeave = () => {
    setHoveredTimelineIdx(null);
  };

  const activeTimelinePoint = hoveredTimelineIdx !== null ? timelinePoints[hoveredTimelineIdx] : null;

  // Framer Motion Variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
  };

  return (
    <motion.div 
      className="flex flex-col gap-6"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      {/* Header */}
      <motion.div variants={cardVariants}>
        <p className="text-[10px] uppercase tracking-[0.35em] text-outline font-black">Intelligence</p>
        <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h3>
        <p className="text-on-surface-variant text-sm mt-1">Deep insights into your knowledge base statistics and system utilization.</p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" variants={cardVariants}>
        
        {/* Total Documents Card */}
        <motion.div 
          className="bg-surface-container/30 border border-outline-variant/15 p-4 sm:p-5 rounded-2xl backdrop-blur-xl flex flex-col justify-between relative overflow-hidden group cursor-default"
          whileHover={{ y: -4, borderColor: 'rgba(var(--color-primary), 0.25)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
        >
          <div className="absolute -right-4 -bottom-4 text-primary/5 text-8xl material-symbols-outlined pointer-events-none group-hover:scale-110 transition-transform duration-500">description</div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-base">description</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Total Documents</span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl sm:text-3xl font-bold text-on-surface font-headline tracking-tight">{data.total_documents}</p>
            <span className="text-[10px] text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[10px] font-bold">arrow_upward</span> Live
            </span>
          </div>
        </motion.div>

        {/* Total Chunks Card */}
        <motion.div 
          className="bg-surface-container/30 border border-outline-variant/15 p-4 sm:p-5 rounded-2xl backdrop-blur-xl flex flex-col justify-between relative overflow-hidden group cursor-default"
          whileHover={{ y: -4, borderColor: 'rgba(var(--color-secondary), 0.25)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
        >
          <div className="absolute -right-4 -bottom-4 text-secondary/5 text-8xl material-symbols-outlined pointer-events-none group-hover:scale-110 transition-transform duration-500">segment</div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-base">segment</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Total Chunks</span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl sm:text-3xl font-bold text-on-surface font-headline tracking-tight">{data.total_chunks}</p>
            <span className="text-[10px] text-outline font-medium">Split segments</span>
          </div>
        </motion.div>

        {/* Average Chunks/Doc Card */}
        <motion.div 
          className="bg-surface-container/30 border border-outline-variant/15 p-4 sm:p-5 rounded-2xl backdrop-blur-xl flex flex-col justify-between relative overflow-hidden group cursor-default"
          whileHover={{ y: -4, borderColor: 'rgba(var(--color-tertiary), 0.25)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
        >
          <div className="absolute -right-4 -bottom-4 text-tertiary/5 text-8xl material-symbols-outlined pointer-events-none group-hover:scale-110 transition-transform duration-500">analytics</div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-tertiary/10 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined text-base">analytics</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Avg Chunks / Doc</span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <p className="text-2xl sm:text-3xl font-bold text-on-surface font-headline tracking-tight">{data.avg_chunks_per_doc}</p>
            <span className="text-[10px] text-outline font-medium">Mean density</span>
          </div>
        </motion.div>

        {/* AI Usage Card */}
        <motion.div 
          className="bg-surface-container/30 border border-outline-variant/15 p-4 sm:p-5 rounded-2xl backdrop-blur-xl flex flex-col justify-between relative overflow-hidden group cursor-default"
          whileHover={{ y: -4, borderColor: 'rgba(var(--color-primary), 0.25)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-base">smart_toy</span>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-outline font-bold">AI Usage Limit</span>
            </div>
            <span className="text-[9px] uppercase font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{data.usage.plan} Plan</span>
          </div>
          <div className="mt-2">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xl sm:text-2xl font-bold text-on-surface font-headline tracking-tight">{data.usage.used} / {data.usage.limit}</span>
              <span className="text-[10px] text-primary font-bold">{data.usage.percentage}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest/60 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${data.usage.percentage}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Upload Timeline Area Chart */}
      <motion.div className="bg-surface-container/30 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl relative overflow-hidden" variants={cardVariants}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-headline font-bold text-base text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary/70">timeline</span>
            Upload Activity Timeline
          </h4>
          <span className="text-[10px] text-outline font-medium px-2 py-1 rounded bg-surface-container/60 border border-outline-variant/10">Last 30 Days</span>
        </div>

        {data.upload_timeline.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-outline/50 text-xs italic">
            No upload activity recorded in the last 30 days
          </div>
        ) : (
          <div className="relative">
            <svg 
              ref={timelineSvgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
              className="w-full h-56 overflow-visible select-none"
              onMouseMove={handleTimelineMouseMove}
              onMouseLeave={handleTimelineMouseLeave}
            >
              {/* Definitions for Gradients */}
              <defs>
                <linearGradient id="timelineAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4361EE" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#4361EE" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="timelineLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4361EE" />
                  <stop offset="50%" stopColor="#7209B7" />
                  <stop offset="100%" stopColor="#4361EE" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines */}
              {Array.from({ length: 4 }).map((_, idx) => {
                const yVal = paddingY + (idx / 3) * (svgHeight - 2 * paddingY);
                return (
                  <g key={idx}>
                    <line 
                      x1={paddingX} 
                      y1={yVal} 
                      x2={svgWidth - paddingX} 
                      y2={yVal} 
                      stroke="var(--color-outline-variant)" 
                      strokeOpacity="0.12" 
                      strokeDasharray="4 4"
                    />
                    <text 
                      x={paddingX - 10} 
                      y={yVal + 3} 
                      textAnchor="end" 
                      className="text-[9px] fill-outline/50 font-mono"
                    >
                      {Math.round(maxTimelineCount - (idx / 3) * maxTimelineCount)}
                    </text>
                  </g>
                );
              })}

              {/* Area Path */}
              {areaPathD && (
                <motion.path 
                  d={areaPathD} 
                  fill="url(#timelineAreaGradient)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8 }}
                />
              )}

              {/* Stroke Line Path */}
              {linePathD && (
                <motion.path 
                  d={linePathD} 
                  fill="none" 
                  stroke="url(#timelineLineGradient)" 
                  strokeWidth="3.5" 
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
              )}

              {/* Interactive Hover Line and Dot indicators */}
              {activeTimelinePoint && (
                <g>
                  {/* Vertical cursor guide line */}
                  <line 
                    x1={activeTimelinePoint.x} 
                    y1={paddingY} 
                    x2={activeTimelinePoint.x} 
                    y2={svgHeight - paddingY} 
                    stroke="var(--color-primary)" 
                    strokeWidth="1.5" 
                    strokeDasharray="2 2"
                  />
                  {/* Outer Pulsing Glow */}
                  <circle 
                    cx={activeTimelinePoint.x} 
                    cy={activeTimelinePoint.y} 
                    r="8" 
                    fill="var(--color-primary)" 
                    fillOpacity="0.3"
                    className="animate-ping"
                  />
                  {/* Inner Dot marker */}
                  <circle 
                    cx={activeTimelinePoint.x} 
                    cy={activeTimelinePoint.y} 
                    r="5" 
                    fill="var(--color-surface)" 
                    stroke="var(--color-primary)" 
                    strokeWidth="3"
                  />
                </g>
              )}
            </svg>

            {/* X-Axis labels at the bottom */}
            <div className="flex justify-between mt-2 text-[9px] text-outline/60 font-mono px-[35px]">
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

            {/* Interactive Tooltip Overlay */}
            <AnimatePresence>
              {activeTimelinePoint && (
                <motion.div 
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bg-surface-container border border-outline-variant/30 p-2.5 rounded-xl shadow-xl z-20 pointer-events-none"
                  style={{
                    left: `${(activeTimelinePoint.x / svgWidth) * 100}%`,
                    top: `${Math.max(10, (activeTimelinePoint.y / svgHeight) * 100 - 32)}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <p className="text-[10px] text-outline font-medium">
                    {new Date(activeTimelinePoint.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-xs font-bold text-primary mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                    {activeTimelinePoint.count} upload{activeTimelinePoint.count !== 1 ? 's' : ''}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Two Column Grid: Chunk Distribution & Source Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Chunk Distribution Horizontal Pill Chart */}
        <motion.div className="bg-surface-container/30 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl" variants={cardVariants}>
          <h4 className="font-headline font-bold text-base text-on-surface mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary/70">bar_chart</span>
            Chunk Size Distribution
          </h4>
          <div className="space-y-4">
            {Object.entries(data.chunk_distribution).map(([bucket, count]: [string, any]) => {
              const widthPercent = maxBucketCount > 0 ? (count / maxBucketCount) * 100 : 0;
              return (
                <div key={bucket} className="flex items-center gap-3 group">
                  <span className="w-16 text-xs text-outline/80 font-medium font-mono">{bucket}</span>
                  <div className="flex-grow h-3 bg-surface-container-highest/40 rounded-full overflow-hidden border border-outline-variant/10 relative">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-secondary to-primary/80 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: count > 0 ? `${widthPercent}%` : '0%' }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-bold font-mono text-on-surface-variant group-hover:text-secondary transition-colors duration-200">{count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Source Type Breakdown SVG Interactive Donut */}
        <motion.div className="bg-surface-container/30 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl" variants={cardVariants}>
          <h4 className="font-headline font-bold text-base text-on-surface mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary/70">donut_large</span>
            Source Type Breakdown
          </h4>
          
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
            
            {/* SVG Interactive Donut */}
            <div className="relative w-36 h-36 flex-shrink-0">
              <svg 
                viewBox="0 0 120 120" 
                className="w-full h-full transform -rotate-90"
              >
                {/* Background base circle */}
                <circle 
                  cx="60" 
                  cy="60" 
                  r={donutRadius} 
                  fill="none" 
                  stroke="var(--color-outline-variant)" 
                  strokeOpacity="0.1" 
                  strokeWidth="12"
                />

                {donutSlices.map((slice, idx) => {
                  const isHovered = hoveredDonutIdx === idx;
                  return (
                    <motion.circle 
                      key={slice.type}
                      cx="60" 
                      cy="60" 
                      r={donutRadius} 
                      fill="none" 
                      stroke={slice.color} 
                      strokeWidth={isHovered ? 16 : 12}
                      strokeDasharray={donutCircumference}
                      initial={{ strokeDashoffset: donutCircumference }}
                      animate={{ 
                        strokeDashoffset: slice.strokeOffset,
                        strokeWidth: isHovered ? 17 : 12 
                      }}
                      transition={{ 
                        strokeDashoffset: { duration: 1.2, ease: 'easeOut' },
                        strokeWidth: { duration: 0.2 }
                      }}
                      className="cursor-pointer origin-center"
                      style={{ transform: `rotate(${slice.rotation}deg)` }}
                      onMouseEnter={() => setHoveredDonutIdx(idx)}
                      onMouseLeave={() => setHoveredDonutIdx(null)}
                    />
                  );
                })}
              </svg>

              {/* Dynamic Center Text display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <AnimatePresence mode="wait">
                  {hoveredDonutIdx !== null ? (
                    <motion.div 
                      key="slice-info"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      className="text-center"
                    >
                      <span className="text-xl font-bold font-headline capitalize" style={{ color: donutSlices[hoveredDonutIdx].color }}>
                        {donutSlices[hoveredDonutIdx].value}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-outline block">
                        {donutSlices[hoveredDonutIdx].type} ({Math.round(donutSlices[hoveredDonutIdx].percent)}%)
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="total-info"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      className="text-center"
                    >
                      <span className="text-2xl font-bold font-headline text-on-surface">
                        {totalBreakdown}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-outline block">
                        Total Sources
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Interactive Legend List */}
            <div className="flex-grow space-y-2.5 w-full sm:w-auto">
              {sourceTypes.length === 0 ? (
                <p className="text-xs text-outline italic">No sources imported</p>
              ) : (
                donutSlices.map((slice, idx) => {
                  const isHovered = hoveredDonutIdx === idx;
                  return (
                    <div 
                      key={slice.type} 
                      className={`flex items-center justify-between text-xs font-medium p-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                        isHovered 
                          ? 'bg-surface-container border-outline-variant/30 shadow-sm scale-[1.02]' 
                          : 'bg-transparent border-transparent'
                      }`}
                      onMouseEnter={() => setHoveredDonutIdx(idx)}
                      onMouseLeave={() => setHoveredDonutIdx(null)}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2.5 h-2.5 rounded-full transition-transform duration-200" 
                          style={{ 
                            backgroundColor: slice.color,
                            transform: isHovered ? 'scale(1.25)' : 'scale(1)'
                          }} 
                        />
                        <span className={`capitalize transition-colors ${isHovered ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>{slice.type}</span>
                      </div>
                      <span className="text-outline font-mono font-bold">{slice.value} ({Math.round(slice.percent)}%)</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Top Documents by Chunk Count */}
      <motion.div className="bg-surface-container/30 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl" variants={cardVariants}>
        <h4 className="font-headline font-bold text-base text-on-surface mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary/70">list</span>
          Top Documents by Chunk Density
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
                <div key={doc.document_id} className="flex flex-col gap-1.5 group p-2 rounded-xl hover:bg-surface-container-highest/20 transition-all duration-300">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-on-surface truncate max-w-[80%] flex items-center gap-2" title={doc.file_name}>
                      <span className="text-[10px] font-mono text-primary font-bold bg-primary/10 border border-primary/20 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate group-hover:text-primary transition-colors duration-200">{doc.file_name}</span>
                    </span>
                    <span className="font-mono text-on-surface-variant font-bold flex-shrink-0">{doc.chunks} chunks · {doc.pages} pages</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-highest/40 rounded-full overflow-hidden border border-outline-variant/5">
                    <motion.div 
                      className="h-full bg-primary/80 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPercent}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: idx * 0.05 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

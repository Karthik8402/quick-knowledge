import { useEffect, useState } from 'react';
import { useAppData } from '../hooks/useAppData';
import { getHealthDetails } from '../api';

import type { SystemStatus } from '../types';
import { StatusSkeleton } from '../shared/Skeleton';

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const duration = 800;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(interval);
      } else {
        setDisplay(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [value]);

  return <span>{display}</span>;
}

type HealthData = {
  status: string;
  uptime_seconds: number;
  version: string;
  python_version: string;
  disk_free_mb: number | null;
  checks: Record<string, boolean>;
};

export default function StatusPage() {
  const { status } = useAppData();
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    void getHealthDetails().then(d => setHealth(d as HealthData)).catch(console.error);
  }, []);


  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (!status) return (
    <div className="flex flex-col gap-6">
      <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight mb-2 animate-fade-in-up">System Status</h3>
      <StatusSkeleton />
    </div>
  );

  return (
    <div className="flex flex-col gap-5 sm:gap-7">
      <div className="flex flex-col gap-2 animate-fade-in-up">
        <p className="text-[10px] uppercase tracking-[0.35em] text-outline font-black">System Telemetry</p>
        <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">System Status</h3>
        <p className="text-on-surface-variant text-sm">Live diagnostics for your retrieval stack and runtime health.</p>
      </div>

      {health && (
        <div className={`flex flex-wrap items-center justify-between gap-4 sm:gap-6 px-5 sm:px-6 py-4 rounded-2xl border animate-scale-in ${
          health.status === 'healthy'
            ? 'bg-green-400/5 border-green-400/20'
            : 'bg-error/5 border-error/20'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${health.status === 'healthy' ? 'bg-green-400 animate-pulse-glow' : 'bg-error'}`} />
            <span className="text-xs font-bold text-on-surface uppercase tracking-wide">{health.status}</span>
            <span className="text-[10px] text-outline/70">Uptime {formatUptime(health.uptime_seconds)}</span>
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-primary/50">tag</span>
              v{health.version}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs text-primary/50">memory</span>
              Python {health.python_version}
            </span>
            {health.disk_free_mb !== null && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-primary/50">hard_drive</span>
                {health.disk_free_mb} MB free
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-7 bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-7 rounded-2xl sm:rounded-3xl backdrop-blur-xl">
          <p className="text-[10px] uppercase tracking-[0.25em] text-outline font-black mb-4">Core Telemetry</p>
          <div className="space-y-4 sm:space-y-5">
            {[
              { label: 'Vector Engine', value: status.vector_store, icon: 'memory', tone: 'text-primary', chip: true },
              { label: 'Primary LLM Provider', value: status.llm_provider, icon: 'smart_toy', tone: 'text-tertiary', chip: true },
            ].map((item) => (
              <div key={item.label} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-outline-variant/10 pb-4">
                <span className="text-on-surface-variant font-medium flex items-center gap-3">
                  <span className={`material-symbols-outlined text-lg ${item.tone}/70`}>{item.icon}</span>
                  {item.label}
                </span>
                <span className={`font-mono ${item.tone} bg-surface-container/60 px-3 py-1 rounded-full text-xs font-bold uppercase`}>{item.value}</span>
              </div>
            ))}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-outline-variant/10 pb-4">
              <span className="text-on-surface-variant font-medium flex items-center gap-3">
                <span className="material-symbols-outlined text-lg text-secondary/70">database</span>
                RAG Memory Pool
              </span>
              <span className="text-on-surface">
                <strong className="text-xl"><AnimatedNumber value={status.chunks} /></strong>
                <span className="text-on-surface-variant text-sm ml-1">embeddings</span>
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-on-surface-variant font-medium flex items-center gap-3">
                <span className="material-symbols-outlined text-lg text-primary/70">description</span>
                Indexed Documents
              </span>
              <span className="text-on-surface">
                <strong className="text-xl"><AnimatedNumber value={status.documents} /></strong>
                <span className="text-on-surface-variant text-sm ml-1">files</span>
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <div className="bg-surface-container-high/60 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl sm:rounded-3xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className={`material-symbols-outlined text-3xl ${status.store_initialized ? 'text-green-400' : 'text-error'}`}>
                {status.store_initialized ? 'verified' : 'gpp_bad'}
              </span>
              <span className={`text-[10px] uppercase tracking-[0.2em] font-black ${status.store_initialized ? 'text-green-400' : 'text-error'}`}>
                {status.store_initialized ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <p className="font-headline font-bold text-lg sm:text-xl mt-4">Index State</p>
            <p className="text-xs text-on-surface-variant mt-1">Vector store connectivity and initialization.</p>
          </div>
          <div className="bg-surface-container-high/60 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl sm:rounded-3xl backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className={`material-symbols-outlined text-3xl ${status.embeddings_loaded ? 'text-green-400' : 'text-error'}`}>
                {status.embeddings_loaded ? 'neurology' : 'error'}
              </span>
              <span className={`text-[10px] uppercase tracking-[0.2em] font-black ${status.embeddings_loaded ? 'text-green-400' : 'text-error'}`}>
                {status.embeddings_loaded ? 'READY' : 'DOWN'}
              </span>
            </div>
            <p className="font-headline font-bold text-lg sm:text-xl mt-4">Embeddings</p>
            <p className="text-xs text-on-surface-variant mt-1">Embedding runtime and provider availability.</p>
          </div>
        </div>
      </div>

      {health?.checks && (
        <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-outline font-black flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-primary/50">checklist</span>
              Health Checks
            </p>
            <span className="text-[10px] text-outline/60">Auto-refreshes every visit</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(health.checks).map(([key, ok]) => (
              <div key={key} className="flex items-center gap-3 px-4 py-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/10">
                <span className={`material-symbols-outlined text-base ${ok ? 'text-green-400' : 'text-error'}`}>
                  {ok ? 'check_circle' : 'cancel'}
                </span>
                <span className="text-xs text-on-surface font-medium">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

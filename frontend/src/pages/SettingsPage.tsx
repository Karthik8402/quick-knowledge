import { useEffect, useState } from 'react';
import { useAppData } from '../hooks/useAppData';
import type { Settings } from '../types';
import { showToast } from '../shared/Toast';

import { MODEL_CONFIG, VECTOR_STORES, EMBEDDING_MODELS } from '../config/branding';

export default function SettingsPage() {
  const { settings, updateSettingsInContext } = useAppData();
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!localSettings) return;
    setSaving(true);
    try {
      await updateSettingsInContext(localSettings);
      showToast('success', 'Settings Applied', 'Configuration updated and saved to database.');
    } catch (e: any) {
      showToast('error', 'Update Failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!localSettings) return (
    <div className="flex flex-col gap-6 max-w-3xl animate-fade-in-up">
      <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight mb-2">Engine Settings</h3>
      <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-8 rounded-2xl sm:rounded-3xl space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton w-32 h-3 mb-3" />
            <div className="skeleton w-full h-12 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-3xl">
      <div className="animate-fade-in-up">
        <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight mb-2">Engine Settings</h3>
        <p className="text-on-surface-variant text-sm">Configure the RAG pipeline parameters. Changes are stored in the database and persist across server restarts.</p>
      </div>
      
      <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-8 rounded-2xl sm:rounded-3xl backdrop-blur-xl space-y-6 sm:space-y-7 animate-scale-in" style={{ animationDelay: '0.1s' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-outline font-black">Retrieval</p>
            <div>
              <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary/60">tune</span>
                RAG Top K
              </label>
              <input
                type="number"
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 focus-glow transition-all duration-300"
                value={localSettings.rag_top_k}
                min={1}
                max={20}
                onChange={(e) => setLocalSettings({ ...localSettings, rag_top_k: Number(e.target.value) })}
              />
              <p className="text-xs text-on-surface-variant mt-2">How many chunks are injected into the LLM context.</p>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-secondary/60">segment</span>
                Chunk Size
              </label>
              <input
                type="number"
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 focus-glow transition-all duration-300"
                value={localSettings.rag_chunk_size}
                min={100}
                max={4000}
                onChange={(e) => setLocalSettings({ ...localSettings, rag_chunk_size: Number(e.target.value) })}
              />
              <p className="text-xs text-on-surface-variant mt-2">Target chunk size for text splitting.</p>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-secondary/60">horizontal_rule</span>
                Chunk Overlap
              </label>
              <input
                type="number"
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 focus-glow transition-all duration-300"
                value={localSettings.rag_chunk_overlap}
                min={0}
                max={1000}
                onChange={(e) => setLocalSettings({ ...localSettings, rag_chunk_overlap: Number(e.target.value) })}
              />
              <p className="text-xs text-on-surface-variant mt-2">Overlap to keep continuity between chunks.</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-outline font-black">Models</p>
            <div>
              <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-tertiary/60">smart_toy</span>
                LLM Provider
              </label>
              <select
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 focus-glow transition-all duration-300 cursor-pointer"
                value={localSettings.llm_provider}
                onChange={(e) => {
                  const nextProvider = e.target.value;
                  const nextModels = MODEL_CONFIG[nextProvider]?.models || [];
                  const currentModelId = localSettings.llm_model;
                  const nextModel = nextModels.some(m => m.id === currentModelId)
                    ? currentModelId
                    : (nextModels[0]?.id || currentModelId);
                  setLocalSettings({ ...localSettings, llm_provider: nextProvider, llm_model: nextModel });
                }}
              >
                {Object.entries(MODEL_CONFIG).map(([key, provider]) => (
                  <option key={key} value={key}>{provider.displayName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-tertiary/60">frame_source</span>
                LLM Model
              </label>
              <select
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 focus-glow transition-all duration-300 cursor-pointer"
                value={localSettings.llm_model}
                onChange={(e) => setLocalSettings({ ...localSettings, llm_model: e.target.value })}
              >
                {(MODEL_CONFIG[localSettings.llm_provider]?.models || []).map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
                {/* Fallback for models not in config */}
                {!(MODEL_CONFIG[localSettings.llm_provider]?.models || []).some(m => m.id === localSettings.llm_model) && (
                  <option value={localSettings.llm_model}>{localSettings.llm_model} (custom)</option>
                )}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary/60">auto_awesome</span>
                Embedding Model
              </label>
              <select
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 focus-glow transition-all duration-300 cursor-pointer"
                value={localSettings.embedding_model}
                onChange={(e) => setLocalSettings({ ...localSettings, embedding_model: e.target.value })}
              >
                {EMBEDDING_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
                {!EMBEDDING_MODELS.some(m => m.id === localSettings.embedding_model) && (
                  <option value={localSettings.embedding_model}>{localSettings.embedding_model} (custom)</option>
                )}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-secondary/60">database</span>
                Vector Store
              </label>
              <select
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 focus-glow transition-all duration-300 cursor-pointer"
                value={localSettings.vector_store}
                onChange={(e) => setLocalSettings({ ...localSettings, vector_store: e.target.value })}
              >
                {VECTOR_STORES.map((store) => (
                  <option key={store.id} value={store.id}>{store.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-outline font-black">Sampling</p>
            <div>
              <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary/60">thermostat</span>
                Temperature
              </label>
              <input
                type="number"
                step="0.05"
                min={0}
                max={1}
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 focus-glow transition-all duration-300"
                value={localSettings.llm_temperature}
                onChange={(e) => setLocalSettings({ ...localSettings, llm_temperature: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary/60">filter_alt</span>
                Top P
              </label>
              <input
                type="number"
                step="0.05"
                min={0}
                max={1}
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 focus-glow transition-all duration-300"
                value={localSettings.llm_top_p}
                onChange={(e) => setLocalSettings({ ...localSettings, llm_top_p: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-outline font-black">Limits</p>
            <div>
              <label className="text-xs uppercase tracking-widest text-outline font-bold mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-secondary/60">cloud_upload</span>
                Max Upload Size (MB)
              </label>
              <input
                type="number"
                min={1}
                max={200}
                className="w-full bg-surface-container-highest border border-outline-variant/20 rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 ring-primary/50 focus-glow transition-all duration-300"
                value={localSettings.max_upload_size_mb}
                onChange={(e) => setLocalSettings({ ...localSettings, max_upload_size_mb: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-outline-variant/10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary text-on-primary-fixed p-3 rounded-xl font-bold transition-all duration-300 hover:shadow-[0_0_20px_rgba(181,196,255,0.3)] hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span className={`material-symbols-outlined text-lg transition-transform duration-500 ${saving ? 'animate-spin' : ''}`}>
              {saving ? 'progress_activity' : 'save'}
            </span>
            <span>{saving ? 'Synchronizing...' : 'Apply Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Info card */}
      <div className="bg-surface-container-low border border-outline-variant/10 p-4 sm:p-6 rounded-xl sm:rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary/60 text-lg mt-0.5 flex-shrink-0">info</span>
          <div className="text-xs text-on-surface-variant leading-relaxed space-y-1">
            <p><strong className="text-on-surface">Database-backed:</strong> Settings changes survive server restarts.</p>
            <p>Model configuration overrides are loaded directly from the database after initialization.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

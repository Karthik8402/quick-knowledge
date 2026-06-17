import { Link } from 'react-router-dom';
import { useAppData } from '../hooks/useAppData';

type ModelCardData = {
  icon: string;
  title: string;
  name: string;
  status: 'active' | 'inactive';
  tags: string[];
};

export default function ModelsPage() {
  const { systemConfig: config, loading } = useAppData();


  const models: ModelCardData[] = config
    ? [
        {
          icon: 'smart_toy',
          title: 'LLM Model',
          name: `${config.llm_provider} / ${config.llm_model}`,
          status: config.configured ? 'active' : 'inactive',
          tags: ['Streaming', 'RAG', 'Chat'],
        },
        {
          icon: 'auto_awesome',
          title: 'Embedding Model',
          name: `${config.embedding_provider} / ${config.embedding_model}`,
          status: config.configured ? 'active' : 'inactive',
          tags: ['Embeddings', 'Semantic Search'],
        },
        {
          icon: 'database',
          title: 'Vector Store',
          name: config.vector_store,
          status: config.configured ? 'active' : 'inactive',
          tags: ['Indexing', 'Retrieval'],
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.35em] text-outline font-black">Configuration</p>
        <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">AI Models</h3>
        <p className="text-on-surface-variant text-sm mt-1">View and manage the AI models powering your knowledge base.</p>
      </div>

      {/* Model Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl">
              <div className="skeleton w-10 h-10 rounded-xl mb-4" />
              <div className="skeleton w-24 h-3 mb-3" />
              <div className="skeleton w-full h-5 mb-3" />
              <div className="flex gap-2">
                <div className="skeleton w-16 h-5 rounded-full" />
                <div className="skeleton w-12 h-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : models.length === 0 ? (
        <div className="bg-surface-container/40 border border-outline-variant/15 p-8 rounded-2xl text-center">
          <span className="material-symbols-outlined text-4xl text-outline/30 mb-3 block">model_training</span>
          <p className="text-sm text-on-surface-variant mb-2">Unable to load model configuration.</p>
          <p className="text-xs text-outline">Check your backend connection and try again.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {models.map((model, i) => (
            <div
              key={model.title}
              className="bg-surface-container/40 border border-outline-variant/15 p-6 rounded-2xl backdrop-blur-xl hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 animate-fade-in-up"
              style={{ animationDelay: `${(i + 1) * 0.1}s` }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">{model.icon}</span>
                </div>
                <StatusBadge status={model.status} />
              </div>

              {/* Title & Name */}
              <p className="text-[10px] uppercase tracking-widest text-outline font-bold mb-1">{model.title}</p>
              <p className="text-on-surface font-bold font-headline text-lg truncate mb-3" title={model.name}>
                {model.name}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {model.tags.map(tag => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container-highest/50 text-on-surface-variant font-medium border border-outline-variant/10"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Init Error */}
      {config?.init_error && (
        <div className="bg-error/5 border border-error/20 p-4 rounded-2xl flex items-start gap-3 animate-fade-in-up">
          <span className="material-symbols-outlined text-error text-lg mt-0.5">warning</span>
          <div>
            <p className="text-sm font-bold text-on-surface">Initialization Error</p>
            <p className="text-xs text-on-surface-variant mt-1">{config.init_error}</p>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary/60">tune</span>
              Want to change models?
            </h4>
            <p className="text-xs text-on-surface-variant mt-1">
              Update LLM provider, model, embeddings, and vector store in the Settings page.
            </p>
          </div>
          <Link
            to="/settings"
            className="bg-primary text-on-primary-fixed px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 hover:shadow-[0_0_20px_rgba(var(--color-primary),0.3)] hover:scale-[1.01] active:scale-[0.98] flex items-center gap-2 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-base">settings</span>
            Configure in Settings
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  const isActive = status === 'active';
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
      isActive
        ? 'bg-green-400/10 text-green-400'
        : 'bg-error/10 text-error'
    }`}>
      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-error'}`} />
      {status}
    </div>
  );
}

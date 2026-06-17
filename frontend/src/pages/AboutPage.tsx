import { useAppData } from '../hooks/useAppData';
import { BRAND } from '../config/branding';

type TechItem = {
  name: string;
  icon: string;
  description: string;
  category: 'frontend' | 'backend' | 'infrastructure';
};

const TECH_STACK: TechItem[] = [
  { name: 'React 19', icon: 'web', description: 'UI framework', category: 'frontend' },
  { name: 'TypeScript', icon: 'code', description: 'Type-safe JavaScript', category: 'frontend' },
  { name: 'Vite', icon: 'bolt', description: 'Build tool & dev server', category: 'frontend' },
  { name: 'Tailwind CSS', icon: 'palette', description: 'Utility-first styling', category: 'frontend' },
  { name: 'Python / FastAPI', icon: 'terminal', description: 'Backend API framework', category: 'backend' },
  { name: 'Supabase', icon: 'database', description: 'Auth & database', category: 'infrastructure' },
  { name: 'ChromaDB / pgvector', icon: 'memory', description: 'Vector store', category: 'infrastructure' },
  { name: 'Google Gemini / OpenAI', icon: 'smart_toy', description: 'LLM providers', category: 'backend' },
];

export default function AboutPage() {
  const { status, loading } = useAppData();

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent border border-outline-variant/15 p-6 sm:p-8 rounded-2xl sm:rounded-3xl backdrop-blur-xl text-center animate-scale-in">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="material-symbols-outlined text-3xl text-on-primary-container">auto_stories</span>
        </div>
        <h3 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-2">{BRAND.name}</h3>
        <p className="text-on-surface-variant text-sm mb-4">{BRAND.tagline}</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {BRAND.version}
          </span>
          {status && (
            <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-mono">
              {status.vector_store}
            </span>
          )}
          {loading && <div className="skeleton w-20 h-6 rounded-full" />}
        </div>
      </div>

      {/* Description */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <p className="text-sm text-on-surface-variant leading-relaxed">{BRAND.description}</p>
      </div>

      {/* Tech Stack */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <h4 className="font-headline font-bold text-lg mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary/60">layers</span>
          Tech Stack
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TECH_STACK.map((tech, i) => (
            <div
              key={tech.name}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-highest/30 border border-outline-variant/10 hover:bg-surface-container-highest/50 transition-colors animate-fade-in-up"
              style={{ animationDelay: `${(i + 2) * 0.05}s` }}
            >
              <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                <span className={`material-symbols-outlined text-lg ${
                  tech.category === 'frontend' ? 'text-primary' :
                  tech.category === 'backend' ? 'text-secondary' : 'text-tertiary'
                }`}>{tech.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{tech.name}</p>
                <p className="text-[10px] text-on-surface-variant">{tech.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Links & Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        {/* GitHub */}
        <a
          href="https://github.com/Karthik8402/intelligent-knowledge"
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-surface-container/40 border border-outline-variant/15 p-5 rounded-2xl hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-2xl group-hover:scale-110 transition-transform">code</span>
            <h4 className="font-bold text-on-surface">Source Code</h4>
          </div>
          <p className="text-xs text-on-surface-variant mb-3">View the open-source repository on GitHub.</p>
          <div className="flex items-center gap-1 text-xs text-primary">
            <span>Karthik8402/intelligent-knowledge</span>
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </div>
        </a>

        {/* License */}
        <div className="bg-surface-container/40 border border-outline-variant/15 p-5 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-secondary text-2xl">license</span>
            <h4 className="font-bold text-on-surface">License</h4>
          </div>
          <p className="text-xs text-on-surface-variant mb-3">This project is distributed under the MIT License.</p>
          <span className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-wider">
            MIT License
          </span>
        </div>
      </div>

      {/* Credits */}
      <div className="bg-surface-container-low border border-outline-variant/10 p-4 sm:p-6 rounded-xl sm:rounded-2xl animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary-container">person</span>
            </div>
            <div>
              <p className="text-sm font-bold text-on-surface">Built by {BRAND.author}</p>
              <p className="text-[11px] text-on-surface-variant">{BRAND.copyright}</p>
            </div>
          </div>
          <span className="text-[10px] text-outline font-mono">{BRAND.version}</span>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppData } from '../hooks/useAppData';
import { BRAND } from '../config/branding';

export default function DashboardPage() {
  const { user } = useAuth();
  const { documents, status, usage: usageData, loading } = useAppData();

  const profileName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  const totalChunks = documents.reduce((s, d) => s + d.chunks, 0);
  const recentDocs = [...documents].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 5);

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent border border-outline-variant/15 p-6 sm:p-8 rounded-2xl sm:rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-on-primary-container font-black text-xl shadow-lg">
            {profileName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {profileName}
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">{BRAND.tagline}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon="description" label="Documents" value={loading ? '…' : documents.length.toString()} color="primary" />
        <StatCard icon="segment" label="Chunks" value={loading ? '…' : totalChunks.toString()} color="secondary" />
        <StatCard icon="smart_toy" label="AI Usage" value={usageData ? `${usageData.used}/${usageData.limit}` : '…'} color="tertiary" />
        <StatCard icon="database" label="Storage" value={status?.vector_store || '…'} color="primary" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Link to="/documents" className="group bg-surface-container/40 border border-outline-variant/15 p-5 rounded-2xl hover:bg-surface-container/60 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-primary text-2xl group-hover:scale-110 transition-transform">upload_file</span>
            <h3 className="font-bold text-on-surface">Upload Documents</h3>
          </div>
          <p className="text-xs text-on-surface-variant">Upload PDF, DOCX, TXT, or MD files to index.</p>
        </Link>
        <Link to="/chat" className="group bg-surface-container/40 border border-outline-variant/15 p-5 rounded-2xl hover:bg-surface-container/60 hover:border-secondary/30 transition-all duration-300 hover:shadow-lg hover:shadow-secondary/5">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-secondary text-2xl group-hover:scale-110 transition-transform">chat</span>
            <h3 className="font-bold text-on-surface">Start Chat</h3>
          </div>
          <p className="text-xs text-on-surface-variant">Ask questions about your uploaded documents.</p>
        </Link>
        <Link to="/settings" className="group bg-surface-container/40 border border-outline-variant/15 p-5 rounded-2xl hover:bg-surface-container/60 hover:border-tertiary/30 transition-all duration-300 hover:shadow-lg hover:shadow-tertiary/5">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-tertiary text-2xl group-hover:scale-110 transition-transform">tune</span>
            <h3 className="font-bold text-on-surface">Configure</h3>
          </div>
          <p className="text-xs text-on-surface-variant">Adjust RAG parameters and LLM settings.</p>
        </Link>
      </div>

      {/* Recent Documents */}
      <div className="bg-surface-container/40 border border-outline-variant/15 p-5 sm:p-6 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Space_Grotesk'] font-bold text-lg">Recent Documents</h3>
          <Link to="/documents" className="text-xs text-primary hover:underline">View All</Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton w-full h-12 rounded-xl" />)}
          </div>
        ) : recentDocs.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-outline/30 mb-3 block">folder_off</span>
            <p className="text-sm text-on-surface-variant">No documents uploaded yet.</p>
            <Link to="/documents" className="text-xs text-primary hover:underline mt-2 inline-block">Upload your first document</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentDocs.map(doc => (
              <div key={doc.document_id} className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-highest/40 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-lg text-primary/60">description</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{doc.file_name}</p>
                    <p className="text-[11px] text-on-surface-variant">{doc.pages} pages · {doc.chunks} chunks</p>
                  </div>
                </div>
                <Link
                  to={`/chat?doc=${doc.document_id}`}
                  className="opacity-0 group-hover:opacity-100 text-xs text-primary hover:underline transition-opacity flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                  Chat
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Health */}
      {status && (
        <div className="bg-surface-container/40 border border-outline-variant/15 p-5 rounded-2xl">
          <h3 className="font-['Space_Grotesk'] font-bold text-lg mb-4">System Health</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <HealthBadge label="Vector Store" ok={status.store_initialized} />
            <HealthBadge label="Embeddings" ok={status.embeddings_loaded} />
            <HealthBadge label="Documents" ok={status.documents > 0} />
            <HealthBadge label="Chunks" ok={status.chunks > 0} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-container/40 border border-outline-variant/15 p-4 sm:p-5 rounded-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className={`material-symbols-outlined text-base text-${color}/60`}>{icon}</span>
        <span className="text-[10px] uppercase tracking-widest text-outline font-bold">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-on-surface font-['Space_Grotesk'] tracking-tight">{value}</p>
    </div>
  );
}

function HealthBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${ok ? 'bg-green-400' : 'bg-red-400'}`} 
           style={{ boxShadow: ok ? '0 0 6px rgba(74, 222, 128, 0.4)' : '0 0 6px rgba(248,113,113,0.4)' }} />
      <span className="text-xs text-on-surface-variant">{label}</span>
    </div>
  );
}

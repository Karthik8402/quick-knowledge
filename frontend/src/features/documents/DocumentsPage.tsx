import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteDocument, getDocumentChunks, uploadDocuments } from '../../api';
import type { DocumentMetadata, RawChunk } from '../../types';
import ConfirmToast from '../../components/ui/ConfirmToast';
import { showToast } from '../../shared/Toast';
import { TableSkeleton } from '../../shared/Skeleton';
import { useAppData } from '../../hooks/useAppData';

export default function DocumentsPage() {
  const { documents: docs, loading, refreshDocuments } = useAppData();
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chunks, setChunks] = useState<RawChunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Upload handler ── */
  const handleUpload = useCallback(async (files: File[]) => {
    if (!files.length) return;

    const MAX_SIZE = 25 * 1024 * 1024; // 25MB according to UI text
    const ALLOWED = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        showToast('error', 'Upload Failed', `File ${file.name} is too large (max 25MB)`);
        return;
      }
      if (!ALLOWED.includes(file.type) && !file.name.endsWith('.md')) {
        showToast('error', 'Upload Failed', `File ${file.name} has an unsupported type`);
        return;
      }
    }

    setUploading(true);
    try {
      const results = await uploadDocuments(files);
      await refreshDocuments();
      const indexed = results.filter((r) => r.status === 'indexed').length;
      const failed = results.filter((r) => r.status === 'failed').length;
      if (indexed > 0) showToast('success', `${indexed} file(s) indexed`, `${results.reduce((s, r) => s + r.chunks, 0)} chunks created`);
      if (failed > 0) showToast('error', `${failed} file(s) failed`, results.find((r) => r.status === 'failed')?.error);
    } catch (e: any) {
      showToast('error', 'Upload Failed', e.message);
    } finally {
      setUploading(false);
    }
  }, [refreshDocuments]);

  /* ── Delete ── */
  const removeDoc = async (id: string, name: string) => {
    setDeletingId(id);
    try {
      await deleteDocument(id);
      showToast('success', 'Document Deleted', `${name} removed from knowledge base`);
      if (expandedId === id) { setExpandedId(null); setChunks([]); }
      void refreshDocuments();
    } catch (e: any) {
      showToast('error', 'Delete Failed', e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const requestDelete = (id: string, name: string) => {
    if (deletingId) return;
    setPendingDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setPendingDelete(null);
    await removeDoc(id, name);
  };

  /* ── Expand / collapse inline chunks ── */
  const toggleExpand = async (docId: string) => {
    if (expandedId === docId) {
      setExpandedId(null);
      setChunks([]);
      return;
    }
    setExpandedId(docId);
    setChunksLoading(true);
    try {
      const res = await getDocumentChunks(docId);
      setChunks(res.chunks);
    } catch (e: any) {
      setChunks([]);
      showToast('error', 'Retrieval Failed', e.message);
    } finally {
      setChunksLoading(false);
    }
  };

  /* ── Drag & Drop ── */
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      ['.pdf', '.txt', '.md', '.docx'].some(ext => f.name.toLowerCase().endsWith(ext))
    );
    if (files.length) handleUpload(files);
  }, [handleUpload]);

  const fileIcon = (name: string) =>
    name.endsWith('.pdf') ? 'picture_as_pdf' :
    name.endsWith('.md') ? 'markdown' :
    name.endsWith('.docx') ? 'article' : 'description';

  return (
    <div className="space-y-6">
      <ConfirmToast
        open={Boolean(pendingDelete)}
        title="Delete document?"
        message={pendingDelete ? `"${pendingDelete.name}" will be removed from the vector store.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        tone="danger"
        busy={Boolean(deletingId)}
      />
      {/* ── Header ── */}
      <div className="animate-fade-in-up">
        <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight mb-1">Knowledge Base</h3>
        <p className="text-on-surface-variant text-sm">Upload, manage, and inspect documents in the vector store.</p>
      </div>

      {/* ── Upload Zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center
          transition-all duration-300 animate-scale-in group
          ${dragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-outline-variant/30 bg-surface-container/30 hover:border-primary/40 hover:bg-surface-container/50'
          }
          ${uploading ? 'pointer-events-none opacity-60' : ''}
        `}
        style={{ animationDelay: '0.05s' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.txt,.docx,.md"
          onChange={(e) => {
            if (e.target.files) handleUpload(Array.from(e.target.files));
            e.target.value = '';
          }}
        />

        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
            dragOver ? 'bg-primary/20 scale-110' : 'bg-surface-container group-hover:bg-primary/10'
          }`}>
            <span className={`material-symbols-outlined text-2xl transition-all duration-300 ${
              uploading ? 'animate-spin text-primary' :
              dragOver ? 'text-primary' : 'text-outline group-hover:text-primary'
            }`}>
              {uploading ? 'progress_activity' : 'cloud_upload'}
            </span>
          </div>

          {uploading ? (
            <p className="text-sm font-medium text-primary">Processing files…</p>
          ) : (
            <>
              <p className="text-sm font-medium text-on-surface">
                {dragOver ? 'Drop files here' : 'Drag & drop files or click to browse'}
              </p>
              <p className="text-[10px] text-outline">Supports PDF, TXT, MD, DOCX — Max 25 MB per file</p>
            </>
          )}
        </div>
      </div>

      {/* ── Document List ── */}
      <div className="bg-surface-container/40 border border-outline-variant/15 rounded-2xl backdrop-blur-xl overflow-hidden animate-scale-in" style={{ animationDelay: '0.1s' }}>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={3} />
          </div>
        ) : docs.length === 0 ? (
          <div className="px-4 py-16 text-center animate-fade-in-up">
            <span className="material-symbols-outlined text-5xl text-outline/20 mb-4 block animate-float">folder_off</span>
            <p className="text-outline text-sm mb-1">No documents in your knowledge base</p>
            <p className="text-[11px] text-outline/50">Upload files above to get started</p>
          </div>
        ) : (
          <div>
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-4 lg:px-6 py-3 bg-surface-container-high/60 border-b border-outline-variant/15 text-[10px] text-outline uppercase tracking-widest font-bold">
              <div className="col-span-5">Document</div>
              <div className="col-span-2 text-center">Type</div>
              <div className="col-span-1 text-center">Pages</div>
              <div className="col-span-2 text-center">Chunks</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Document rows */}
            {docs.map((doc, i) => (
              <div
                key={doc.document_id}
                className={`animate-fade-in-up border-b border-outline-variant/10 last:border-0 transition-all duration-300 ${
                  deletingId === doc.document_id ? 'opacity-40 scale-[0.99]' : ''
                } ${expandedId === doc.document_id ? 'bg-surface-container/30' : ''}`}
                style={{ animationDelay: `${0.04 * i}s` }}
              >
                {/* Row */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 px-4 lg:px-6 py-4 items-center group">
                  {/* Document name — clickable to expand */}
                  <button
                    className="sm:col-span-5 flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                    onClick={() => toggleExpand(doc.document_id)}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      expandedId === doc.document_id ? 'bg-primary/15' : 'bg-surface-container group-hover:bg-primary/10'
                    }`}>
                      <span className={`material-symbols-outlined text-base transition-colors ${
                        expandedId === doc.document_id ? 'text-primary' : 'text-outline group-hover:text-primary'
                      }`}>
                        {fileIcon(doc.file_name)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#b5c4ff] truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-outline sm:hidden mt-0.5">
                        {doc.source_type.toUpperCase()} · {doc.pages} pages · {doc.chunks} chunks
                      </p>
                    </div>
                    <span className={`material-symbols-outlined text-sm text-outline transition-transform duration-300 ${
                      expandedId === doc.document_id ? 'rotate-180' : ''
                    }`}>
                      expand_more
                    </span>
                  </button>

                  {/* Desktop columns */}
                  <div className="hidden sm:flex sm:col-span-2 justify-center">
                    <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase">
                      {doc.source_type}
                    </span>
                  </div>
                  <div className="hidden sm:flex sm:col-span-1 justify-center text-sm text-on-surface-variant">
                    {doc.pages}
                  </div>
                  <div className="hidden sm:flex sm:col-span-2 justify-center">
                    <span className="text-tertiary font-bold text-sm">{doc.chunks}</span>
                    <span className="text-[10px] text-outline ml-1 mt-0.5">chunks</span>
                  </div>
                  <div className="hidden sm:flex sm:col-span-2 justify-end gap-2">
                    <Link
                      to={`/chat?doc=${doc.document_id}`}
                      className="text-primary hover:text-primary-light p-2 rounded-lg hover:bg-primary/10 transition-all duration-200 active:scale-90"
                      title="Chat with Document"
                    >
                      <span className="material-symbols-outlined text-sm">chat</span>
                    </Link>
                    <button
                      onClick={(e) => { e.stopPropagation(); requestDelete(doc.document_id, doc.file_name); }}
                      disabled={deletingId === doc.document_id}
                      className="text-error hover:text-red-400 p-2 rounded-lg hover:bg-error/10 transition-all duration-200 active:scale-90"
                      title="Delete Document"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {deletingId === doc.document_id ? 'progress_activity' : 'delete'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Mobile actions */}
                <div className="sm:hidden px-4 pb-3 flex justify-end gap-2">
                  <Link
                    to={`/chat?doc=${doc.document_id}`}
                    className="text-[10px] text-primary border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-all"
                  >
                    Chat
                  </Link>
                  <button
                    onClick={() => requestDelete(doc.document_id, doc.file_name)}
                    disabled={deletingId === doc.document_id}
                    className="text-[10px] text-error border border-error/20 px-3 py-1.5 rounded-lg hover:bg-error/10 transition-all"
                  >
                    {deletingId === doc.document_id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>

                {/* Expanded inline chunks */}
                {expandedId === doc.document_id && (
                  <div className="px-4 lg:px-6 pb-5 animate-fade-in-up">
                    <div className="ml-0 sm:ml-12 border-l-2 border-primary/20 pl-4">
                      <p className="text-[10px] uppercase tracking-widest text-outline font-bold mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary/50">segment</span>
                        Vector Chunks ({chunks.length})
                      </p>

                      {chunksLoading ? (
                        <div className="space-y-2">
                          {[1,2,3].map(n => (
                            <div key={n} className="skeleton w-full h-16 rounded-xl" />
                          ))}
                        </div>
                      ) : chunks.length === 0 ? (
                        <p className="text-xs text-outline italic">No chunks found in memory.</p>
                      ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                          {chunks.map((ck, ci) => (
                            <div
                              key={ci}
                              className="bg-surface-container-low/60 border border-outline-variant/10 rounded-xl p-3 hover:border-primary/20 transition-all duration-200 group/chunk"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center text-[9px] font-black text-primary">
                                    {ci + 1}
                                  </span>
                                  <span className="text-[10px] text-outline font-bold uppercase tracking-wider">Chunk</span>
                                </div>
                                {ck.page && (
                                  <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-md font-medium">
                                    Page {ck.page}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-3 group-hover/chunk:text-on-surface transition-colors">
                                {ck.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

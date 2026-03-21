import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/home/TopBar';
import BrainExplorerHeader from '../components/note/BrainExplorerHeader';
import { useBrains, useBrainSources, useDeleteSource } from '../api/brainQueries';

const API_URL = import.meta.env.VITE_API_URL ?? '';

function useAuthFileUrl(brainId, sourceId, enabled) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !brainId || !sourceId) {
      setUrl(null);
      setErr(null);
      return;
    }
    const token = localStorage.getItem('access_token');
    let revoked = false;
    let objectUrl = null;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/brain/${brainId}/sources/${sourceId}/file`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Could not load file');
        const blob = await res.blob();
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e) {
        if (!revoked) setErr(e.message || 'Failed to load');
      } finally {
        if (!revoked) setLoading(false);
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [brainId, sourceId, enabled]);

  return { url, err, loading };
}

export default function BrainSourcesView() {
  const { brainId } = useParams();
  const navigate = useNavigate();
  const { data: brains = [] } = useBrains();
  const { data: sources = [], isFetching, refetch } = useBrainSources(brainId);
  const deleteSource = useDeleteSource(brainId);

  const [preview, setPreview] = useState(null);
  const brainName = brains.find((b) => b.id === brainId)?.name || 'Brain';

  const open = preview?.id;
  const isImage = preview?.file_type === 'image';
  const isPdf = preview?.file_type === 'pdf';
  const { url, err, loading } = useAuthFileUrl(brainId, open, !!open && !!preview?.has_file);

  const handleView = (s) => {
    if (!s.has_file) {
      window.alert('This source has no stored file (e.g. text extracted only).');
      return;
    }
    setPreview(s);
  };

  const openInNewTab = () => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex flex-col">
      <TopBar compact breadcrumb={`Home › ${brainName} › Sources`} activeBrainName={brainName} />
      <BrainExplorerHeader
        title="Sources"
        right={
          <button
            type="button"
            onClick={() => navigate(`/brain/${brainId}/notes`)}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Notes workspace
          </button>
        }
      />
      <main className="flex-1 overflow-auto p-6 max-w-3xl mx-auto w-full">
        <p className="text-sm text-[var(--text2)] mb-4">
          Files and scans attached to this brain. Images open in the preview; PDFs open in a new tab.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mb-4 text-xs font-medium text-[var(--accent)] hover:underline"
        >
          {isFetching ? 'Refreshing…' : 'Refresh list'}
        </button>
        {sources.length === 0 ? (
          <p className="text-sm text-[var(--text3)]">No sources yet. Upload from the notes workspace landing page.</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--hairline)] bg-[var(--bg2)] px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text1)] truncate">{s.filename}</p>
                  <p className="text-xs text-[var(--text3)] mono">{s.file_type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleView(s)}
                  className="h-8 px-3 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/30"
                >
                  View
                </button>
                <button
                  type="button"
                  disabled={deleteSource.isPending}
                  onClick={() => {
                    if (!window.confirm(`Remove “${s.filename}” from this brain?`)) return;
                    deleteSource.mutate(s.id);
                    if (preview?.id === s.id) setPreview(null);
                  }}
                  className="h-8 px-2 text-xs text-red-400/90 hover:text-red-300 disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[color:var(--veil)]"
          onClick={() => setPreview(null)}
          role="presentation"
        >
          <div
            className="bg-[var(--bg2)] border border-[color:var(--hairline-strong)] rounded-xl max-w-[min(96vw,900px)] max-h-[90vh] w-full flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[color:var(--hairline)]">
              <p className="text-sm font-medium text-[var(--text1)] truncate">{preview.filename}</p>
              <div className="flex items-center gap-2 shrink-0">
                {(isPdf || isImage) && url ? (
                  <button type="button" onClick={openInNewTab} className="text-xs text-[var(--accent)] hover:underline">
                    Open in new tab
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="text-sm text-[var(--text3)] hover:text-[var(--text1)] px-2"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-[200px] max-h-[calc(90vh-56px)] overflow-auto p-4 flex items-center justify-center bg-[var(--bg3)]">
              {loading ? (
                <p className="text-sm text-[var(--text3)]">Loading…</p>
              ) : err ? (
                <p className="text-sm text-amber-800 text-center">{err}</p>
              ) : isImage && url ? (
                <img src={url} alt={preview.filename} className="max-w-full max-h-[min(70vh,720px)] object-contain rounded-lg border border-[color:var(--hairline)]" />
              ) : isPdf && url ? (
                <iframe title={preview.filename} src={url} className="w-full h-[min(70vh,720px)] rounded-lg border border-[color:var(--hairline)] bg-white" />
              ) : (
                <p className="text-sm text-[var(--text3)]">Preview not available for this type.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

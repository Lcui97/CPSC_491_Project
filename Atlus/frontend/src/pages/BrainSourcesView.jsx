import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/home/TopBar';
import BrainExplorerHeader from '../components/note/BrainExplorerHeader';
import { useBrains, useBrainSources, useDeleteSource } from '../api/brainQueries';

const API_URL = import.meta.env.VITE_API_URL ?? '';

function useAuthFileUrl(classId, sourceId, enabled, sourceFileType) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !classId || !sourceId) {
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
        const res = await fetch(`${API_URL}/api/brain/${classId}/sources/${sourceId}/file`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Could not load file');
        const buf = await res.arrayBuffer();
        if (revoked) return;
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const blob =
          ct.includes('pdf') || sourceFileType === 'pdf'
            ? new Blob([buf], { type: 'application/pdf' })
            : new Blob([buf], { type: ct && !ct.includes('octet-stream') ? ct : 'application/octet-stream' });
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
  }, [classId, sourceId, enabled, sourceFileType]);

  return { url, err, loading };
}

export default function BrainSourcesView() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { data: classes = [] } = useBrains();
  const { data: sources = [], isFetching, refetch } = useBrainSources(classId);
  const deleteSource = useDeleteSource(classId);

  const [preview, setPreview] = useState(null);
  const classTitle = classes.find((b) => b.id === classId)?.name || 'Class';

  const open = preview?.id;
  const isImage = preview?.file_type === 'image';
  const isPdf = preview?.file_type === 'pdf';
  const { url, err, loading } = useAuthFileUrl(
    classId,
    open,
    !!open && !!preview?.has_file,
    preview?.file_type
  );

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
    <div className="note-page">
      <TopBar compact breadcrumb={`Home › ${classTitle} › Sources`} />
      <BrainExplorerHeader
        title="Sources"
        right={
          <div className="explorer-header-actions">
            <button
              type="button"
              onClick={() => navigate(`/ingest?class=${encodeURIComponent(classId)}`)}
              className="text-link"
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => navigate(`/class/${classId}/notes`)}
              className="text-link"
            >
              Notes workspace
            </button>
          </div>
        }
      />
      <main style={{ flex: 1, overflow: 'auto', padding: '1.5rem', maxWidth: '48rem', margin: '0 auto', width: '100%' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--text2)', marginBottom: '1rem' }}>
          Files and scans attached to this class. Images open in the preview; PDFs open in a new tab.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-link"
          style={{ fontSize: '0.75rem', fontWeight: 500, marginBottom: '1rem', display: 'block' }}
        >
          {isFetching ? 'Refreshing…' : 'Refresh list'}
        </button>
        {sources.length === 0 ? (
          <p className="text-muted">No sources yet. Upload from the notes workspace landing page.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sources.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-2"
                style={{
                  marginBottom: '0.5rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--hairline)',
                  background: 'var(--bg2)',
                  padding: '0.6rem 0.75rem',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: '0.875rem', color: 'var(--text1)', margin: 0 }} className="truncate">{s.filename}</p>
                  <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--text3)', margin: 0 }}>{s.file_type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleView(s)}
                  className="btn btn-secondary btn-xs"
                  style={{ background: 'rgba(19, 181, 234, 0.15)', color: 'rgb(var(--accent))', borderColor: 'transparent' }}
                >
                  View
                </button>
                <button
                  type="button"
                  disabled={deleteSource.isPending}
                  onClick={() => {
                    if (!window.confirm(`Remove “${s.filename}” from this class?`)) return;
                    deleteSource.mutate(s.id);
                    if (preview?.id === s.id) setPreview(null);
                  }}
                  style={{
                    height: '2rem',
                    padding: '0 0.5rem',
                    fontSize: '0.75rem',
                    color: '#f87171',
                    border: 'none',
                    background: 'none',
                    cursor: deleteSource.isPending ? 'not-allowed' : 'pointer',
                    opacity: deleteSource.isPending ? 0.4 : 1,
                  }}
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
          className="modal-backdrop"
          style={{ background: 'var(--veil)' }}
          onClick={() => setPreview(null)}
          role="presentation"
        >
          <div
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--hairline-strong)',
              borderRadius: '0.75rem',
              maxWidth: 'min(96vw, 900px)',
              maxHeight: '90vh',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-2" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--hairline)' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text1)', margin: 0 }} className="truncate">{preview.filename}</p>
              <div className="flex gap-2 shrink-0 items-center">
                {(isPdf || isImage) && url ? (
                  <button type="button" onClick={openInNewTab} className="text-link" style={{ fontSize: '0.75rem' }}>
                    Open in new tab
                  </button>
                ) : null}
                <button type="button" onClick={() => setPreview(null)} className="text-link">
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center" style={{ minHeight: 200, maxHeight: 'calc(90vh - 56px)', overflow: 'auto', padding: '1rem', background: 'var(--bg3)' }}>
              {loading ? (
                <p className="text-muted">Loading…</p>
              ) : err ? (
                <p style={{ fontSize: '0.875rem', color: '#92400e', textAlign: 'center' }}>{err}</p>
              ) : isImage && url ? (
                <img src={url} alt={preview.filename} style={{ maxWidth: '100%', maxHeight: 'min(70vh, 720px)', objectFit: 'contain', borderRadius: '0.5rem', border: '1px solid var(--hairline)' }} />
              ) : isPdf && url ? (
                <iframe title={preview.filename} src={url} style={{ width: '100%', height: 'min(70vh, 720px)', borderRadius: '0.5rem', border: '1px solid var(--hairline)', background: '#fff' }} />
              ) : (
                <p className="text-muted">Preview not available for this type.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/home/TopBar';
import WorkspaceSidebar from '../components/home/WorkspaceSidebar';
import { useBrains, useMeSummary, useAllMyNotes, useDeleteNode } from '../api/brainQueries';

function snippet(n) {
  const raw = (n.markdown_content || n.summary || '').replace(/^#+\s*/gm, '').trim();
  return raw.slice(0, 140) + (raw.length > 140 ? '…' : '');
}

export default function NotesGallery() {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeBrain, setActiveBrain] = useState(null);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 48;

  const { data: brains = [] } = useBrains();
  const { data: me } = useMeSummary();
  const { data, isFetching, refetch } = useAllMyNotes({ page, per_page: perPage, q: qDebounced });
  const deleteNode = useDeleteNode();

  useEffect(() => {
    const t = setTimeout(() => {
      setQDebounced(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const nodes = data?.nodes ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="note-page">
      <TopBar compact breadcrumb="Home › All notes" />
      <main className="flex-1 flex overflow-hidden min-h-0">
        <WorkspaceSidebar
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
          activeBrain={activeBrain}
          setActiveBrain={setActiveBrain}
          brains={brains}
          me={me}
        />
        <div className="flex-1 flex flex-col overflow-auto min-w-0" style={{ padding: '1.5rem', gap: '1rem' }}>
          <div className="flex flex-col gap-3" style={{ alignItems: 'stretch' }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text1)', margin: 0 }}>All notes</h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--text2)', marginTop: '0.25rem' }}>
                {total} note{total === 1 ? '' : 's'} across your brains · open to edit or delete
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search titles and content…"
                className="input"
                style={{ minWidth: 200, flex: '1 1 200px', maxWidth: 320 }}
              />
              <button
                type="button"
                onClick={() => refetch()}
                className="btn btn-secondary btn-sm"
              >
                Refresh
              </button>
            </div>
          </div>

          {isFetching && !nodes.length ? (
            <p className="text-muted">Loading…</p>
          ) : nodes.length === 0 ? (
            <div style={{ borderRadius: '0.75rem', border: '1px dashed var(--hairline-strong)', padding: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text2)' }}>No notes yet. Create a brain and add notes from the workspace.</p>
              <button type="button" onClick={() => navigate('/home')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Back to home
              </button>
            </div>
          ) : (
            <div className="notes-gallery-grid">
              {nodes.map((n) => {
                const iso = n.updated_at || n.created_at;
                const dateStr = iso
                  ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  : '';
                return (
                  <article
                    key={n.id}
                    style={{
                      borderRadius: '0.75rem',
                      border: '1px solid var(--hairline)',
                      background: 'var(--bg2)',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/brain/${n.brain_id}/notes/${n.id}`)}
                        className="text-left flex-1 min-w-0"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                      >
                        <h2 style={{ fontWeight: 500, color: 'var(--text1)', margin: 0 }} className="truncate">{n.title || 'Untitled'}</h2>
                        <p style={{ fontSize: '0.75rem', color: 'rgb(var(--accent))', marginTop: '0.125rem' }} className="truncate">{n.brain_name || n.brain_id}</p>
                      </button>
                      <button
                        type="button"
                        disabled={deleteNode.isPending}
                        onClick={() => {
                          if (!window.confirm(`Delete “${n.title || 'Untitled'}”? This cannot be undone.`)) return;
                          deleteNode.mutate(
                            { nodeId: n.id, brainId: n.brain_id },
                            { onSuccess: () => refetch() }
                          );
                        }}
                        className="shrink-0 text-link text-danger"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        Delete
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text2)', flex: 1, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {snippet(n) || '—'}
                    </p>
                    <div className="flex items-center justify-between gap-2" style={{ paddingTop: '0.25rem', borderTop: '1px solid var(--hairline-faint)' }}>
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--text3)' }}>{dateStr}</span>
                      <button
                        type="button"
                        onClick={() => navigate(`/brain/${n.brain_id}/notes/${n.id}`)}
                        className="text-link"
                        style={{ fontSize: '0.75rem', fontWeight: 500 }}
                      >
                        Open
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2" style={{ paddingTop: '0.5rem' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <span className="mono text-muted" style={{ fontSize: '0.75rem' }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

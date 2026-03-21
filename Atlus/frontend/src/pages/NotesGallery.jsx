import { useMemo, useState, useEffect } from 'react';
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

  const brainName = useMemo(() => activeBrain?.name || null, [activeBrain]);

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex flex-col">
      <TopBar compact breadcrumb="Home › All notes" activeBrainName={brainName} />
      <main className="flex-1 flex overflow-hidden min-h-0">
        <WorkspaceSidebar
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
          activeBrain={activeBrain}
          setActiveBrain={setActiveBrain}
          brains={brains}
          me={me}
        />
        <div className="flex-1 flex flex-col overflow-auto min-w-0 p-6 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-[var(--text1)]">All notes</h1>
              <p className="text-sm text-[var(--text2)] mt-1">
                {total} note{total === 1 ? '' : 's'} across your brains · open to edit or delete
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search titles and content…"
                className="h-9 min-w-[200px] flex-1 sm:flex-none sm:w-64 px-3 rounded-lg bg-[var(--bg3)] border text-sm text-[var(--text1)] placeholder:text-[var(--text3)] focus:outline-none focus:border-[color:var(--accent-40)]"
                style={{ borderColor: 'var(--border2)' }}
              />
              <button
                type="button"
                onClick={() => refetch()}
                className="h-9 px-3 rounded-lg border text-sm text-[var(--text2)] hover:bg-[var(--bg3)]"
                style={{ borderColor: 'var(--border2)' }}
              >
                Refresh
              </button>
            </div>
          </div>

          {isFetching && !nodes.length ? (
            <p className="text-sm text-[var(--text3)]">Loading…</p>
          ) : nodes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[color:var(--hairline-strong)] p-10 text-center">
              <p className="text-[var(--text2)]">No notes yet. Create a brain and add notes from the workspace.</p>
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="mt-4 h-9 px-4 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
              >
                Back to home
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {nodes.map((n) => {
                const iso = n.updated_at || n.created_at;
                const dateStr = iso
                  ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  : '';
                return (
                  <article
                    key={n.id}
                    className="rounded-xl border border-[color:var(--hairline)] bg-[var(--bg2)] p-4 flex flex-col gap-2 hover:border-[color:var(--hairline-hover)] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/brain/${n.brain_id}/notes/${n.id}`)}
                        className="text-left min-w-0 flex-1"
                      >
                        <h2 className="font-medium text-[var(--text1)] truncate">{n.title || 'Untitled'}</h2>
                        <p className="text-xs text-[var(--accent)] mt-0.5 truncate">{n.brain_name || n.brain_id}</p>
                      </button>
                      <button
                        type="button"
                        disabled={deleteNode.isPending}
                        onClick={() => {
                          if (!window.confirm(`Delete “${n.title || 'Untitled'}”? This cannot be undone.`)) return;
                          deleteNode.mutate(
                            { nodeId: n.id, brainId: n.brain_id },
                            {
                              onSuccess: () => refetch(),
                            }
                          );
                        }}
                        className="shrink-0 text-xs font-medium text-red-400/90 hover:text-red-300 disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text2)] line-clamp-3 flex-1">{snippet(n) || '—'}</p>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[color:var(--hairline-faint)]">
                      <span className="text-[10px] mono text-[var(--text3)]">{dateStr}</span>
                      <button
                        type="button"
                        onClick={() => navigate(`/brain/${n.brain_id}/notes/${n.id}`)}
                        className="text-xs font-medium text-[var(--accent)] hover:underline"
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
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 rounded-lg border border-[color:var(--hairline)] text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-[var(--text3)] mono">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-3 rounded-lg border border-[color:var(--hairline)] text-sm disabled:opacity-40"
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

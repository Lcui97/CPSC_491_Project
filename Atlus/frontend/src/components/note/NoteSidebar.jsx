import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useBrainNodes, useCreateNode, useDeleteNode } from '../../api/brainQueries';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketFor(iso) {
  if (!iso) return 'older';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'older';
  const now = new Date();
  const sod = startOfDay(now);
  const y = new Date(sod);
  y.setDate(y.getDate() - 1);
  const week = new Date(sod);
  week.setDate(week.getDate() - 7);
  if (d >= sod) return 'today';
  if (d >= y && d < sod) return 'yesterday';
  if (d >= week) return 'week';
  return 'older';
}

function snippetFromNode(node) {
  const raw = (node.markdown_content || node.summary || '').replace(/^#+\s*/gm, '').trim();
  return raw.slice(0, 120) + (raw.length > 120 ? '…' : '');
}

export default function NoteSidebar({ onSelectNode }) {
  const { brainId, nodeId: activeNodeId } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sort, setSort] = useState('recent');
  const [createError, setCreateError] = useState('');
  const page = 1;
  const perPage = 100;

  const { data: brain } = useQuery({
    queryKey: ['brains'],
    queryFn: () => api('/api/brain/list').then((r) => (r.brains || []).find((b) => b.id === brainId)),
    enabled: !!brainId,
  });
  const { data: listData, refetch } = useBrainNodes(brainId, { page, per_page: perPage, q, tag: tagFilter, sort });
  const createNode = useCreateNode(brainId);
  const deleteNode = useDeleteNode();

  const nodes = listData?.nodes ?? [];
  const total = listData?.total ?? 0;

  const grouped = useMemo(() => {
    const g = { today: [], yesterday: [], week: [], older: [] };
    nodes.forEach((n) => {
      const iso = n.updated_at || n.created_at;
      g[bucketFor(iso)].push(n);
    });
    return g;
  }, [nodes]);

  const allTags = [];
  nodes.forEach((n) => (n.tags || []).forEach((t) => t && !allTags.includes(t) && allTags.push(t)));
  allTags.sort();

  const handleSelect = (node) => {
    onSelectNode?.(node);
    navigate(`/brain/${brainId}/notes/${node.id}`, { replace: false });
  };

  const handleNewNote = () => {
    if (!brainId) return;
    setCreateError('');
    createNode.mutate(
      {
        title: 'Untitled',
        markdown_content: '# Untitled\n\nStart writing here. Upload handwriting with OCR to get scan + Markdown side by side.',
        tags: [],
        node_type: 'note',
      },
      {
        onSuccess: (data) => {
          navigate(`/brain/${brainId}/notes/${data.id}`, { replace: false, state: { focusTitle: true } });
        },
        onError: (err) => {
          setCreateError(err.message || 'Failed to create note');
        },
      }
    );
  };

  function Section({ label, items }) {
    if (!items.length) return null;
    return (
      <div className="mb-4">
        <p className="mono text-[10px] text-[var(--text3)] px-3 mb-1">{label}</p>
        <ul className="space-y-0.5">
          {items.map((node) => {
            const active = node.id === activeNodeId;
            const iso = node.updated_at || node.created_at;
            const dateStr = iso
              ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : '';
            const tag0 = (node.tags && node.tags[0]) || '';
            return (
              <li key={node.id} className="group flex gap-1 items-stretch">
                <button
                  type="button"
                  onClick={() => handleSelect(node)}
                  className={`flex-1 min-w-0 text-left px-3 py-2 rounded-xl border transition-colors ${
                    active
                      ? 'border-[color:var(--accent-40)] bg-[var(--accent-glow)]'
                      : 'border-transparent hover:bg-[var(--bg4)]'
                  }`}
                >
                  <p className="text-sm text-[var(--text1)] truncate font-medium">{node.title || 'Untitled'}</p>
                  <p className="text-xs text-[var(--text2)] line-clamp-2 mt-0.5">{snippetFromNode(node) || '—'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="mono text-[10px] text-[var(--text3)]">{dateStr}</span>
                    {tag0 ? (
                      <span className="mono text-[10px] px-1.5 py-0.5 rounded-[10px] bg-[var(--bg3)] text-[var(--accent)] border border-[color:var(--accent-20)]">
                        {tag0}
                      </span>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  title="Delete note"
                  disabled={deleteNode.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!window.confirm(`Delete “${node.title || 'Untitled'}”?`)) return;
                    deleteNode.mutate(
                      { nodeId: node.id, brainId },
                      {
                        onSuccess: () => {
                          refetch();
                          if (node.id === activeNodeId) {
                            navigate(`/brain/${brainId}/notes`, { replace: true });
                          }
                        },
                      }
                    );
                  }}
                  className="shrink-0 w-8 rounded-xl border border-transparent text-[var(--text3)] hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5 opacity-70 group-hover:opacity-100 disabled:opacity-40 text-xs"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <aside
      className="w-[220px] shrink-0 border-r border-[color:var(--hairline)] flex flex-col overflow-hidden"
      style={{ background: 'var(--bg2)' }}
    >
      <div className="p-2 border-b border-[color:var(--hairline)]">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              refetch();
            }
          }}
          placeholder="Filter notes…"
          className="w-full h-9 px-3 rounded-lg bg-[var(--bg3)] border text-sm text-[var(--text1)] placeholder:text-[var(--text3)] focus:outline-none focus:border-[color:var(--accent-40)]"
          style={{ borderColor: 'var(--border2)' }}
        />
      </div>
      <div className="px-3 py-2 border-b border-[color:var(--hairline)] flex items-center justify-between gap-2">
        <span className="mono text-[11px] text-[var(--text2)]">{total} notes</span>
        <button
          type="button"
          onClick={handleNewNote}
          disabled={createNode.isPending || !brainId}
          className="h-8 px-2 rounded-lg border border-dashed border-[color:var(--hairline-dash)] text-[var(--accent)] text-lg leading-none hover:bg-[var(--bg3)] disabled:opacity-50"
          title="New note"
        >
          +
        </button>
      </div>
      {createError ? <p className="px-3 py-1 text-xs text-[#ff6b6b]">{createError}</p> : null}
      <div className="px-2 py-2 flex gap-1 flex-wrap border-b border-[color:var(--hairline)]">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-8 px-2 rounded-lg border text-xs bg-[var(--bg3)] text-[var(--text1)]"
          style={{ borderColor: 'var(--border2)' }}
        >
          <option value="recent">Recent</option>
          <option value="alpha">A–Z</option>
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="h-8 px-2 rounded-lg border text-xs bg-[var(--bg3)] text-[var(--text1)] min-w-0 flex-1"
          style={{ borderColor: 'var(--border2)' }}
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <nav className="flex-1 overflow-y-auto py-2 px-1">
        <p className="px-2 text-xs text-[var(--text2)] truncate mb-2" title={brain?.name}>
          {brain?.name || '…'}
        </p>
        <Section label="TODAY" items={grouped.today} />
        <Section label="YESTERDAY" items={grouped.yesterday} />
        <Section label="THIS WEEK" items={grouped.week} />
        <Section label="OLDER" items={grouped.older} />
        {nodes.length === 0 ? <p className="px-3 text-sm text-[var(--text3)]">No notes match.</p> : null}
      </nav>
    </aside>
  );
}

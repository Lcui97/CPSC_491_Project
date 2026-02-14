import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useBrainNodes, useCreateNode } from '../../api/brainQueries';

export default function NoteSidebar({ onSelectNode }) {
  const { brainId } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [createError, setCreateError] = useState('');
  const perPage = 50;

  const { data: brain } = useQuery({
    queryKey: ['brains'],
    queryFn: () => api('/api/brain/list').then((r) => (r.brains || []).find((b) => b.id === brainId)),
    enabled: !!brainId,
  });
  const { data: listData, refetch } = useBrainNodes(brainId, { page, per_page: perPage, q, tag: tagFilter, sort });
  const createNode = useCreateNode(brainId);

  const nodes = listData?.nodes ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.ceil(total / perPage) || 1;

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
        markdown_content: '# Untitled\n\nStart writing here. Use the sidebar to open other notes and the **Graph** to see connections.',
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

  return (
    <aside className="w-64 shrink-0 border-r border-[rgb(var(--border))] bg-[rgb(var(--panel))] flex flex-col overflow-hidden">
      <div className="p-2 border-b border-[rgb(var(--border))] flex items-center justify-between gap-1">
        <p className="text-sm font-medium text-[rgb(var(--text))] truncate px-2 py-1" title={brain?.name}>{brain?.name || '…'}</p>
        <button
          type="button"
          onClick={handleNewNote}
          disabled={createNode.isPending || !brainId}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-lg leading-none disabled:opacity-50"
          title="New note"
        >
          +
        </button>
      </div>
      {createError && (
        <p className="px-2 py-1 text-xs text-red-500" role="alert">{createError}</p>
      )}
      <div className="p-2 space-y-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setPage(1) && refetch()}
          placeholder="Search notes…"
          className="w-full px-3 py-2 rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border))] text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
        />
        <div className="flex gap-1 flex-wrap">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-2 py-1.5 rounded border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] text-[rgb(var(--text))] text-xs">
            <option value="recent">Recent</option>
            <option value="alpha">A–Z</option>
          </select>
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="px-2 py-1.5 rounded border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] text-[rgb(var(--text))] text-xs min-w-0">
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto">
        <ul className="py-1">
          {nodes.map((node) => (
            <li key={node.id}>
              <button type="button" onClick={() => handleSelect(node)} className="w-full text-left px-3 py-2 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))] truncate">
                {node.title || 'Untitled'}
              </button>
            </li>
          ))}
        </ul>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-2 border-t border-[rgb(var(--border))]">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] disabled:opacity-50">Prev</button>
            <span className="text-xs text-[rgb(var(--muted))]">{page} / {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] disabled:opacity-50">Next</button>
          </div>
        )}
      </nav>
    </aside>
  );
}

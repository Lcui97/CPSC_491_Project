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
      <div style={{ marginBottom: '1rem' }}>
        <p className="ns-section-label">{label}</p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((node) => {
            const active = node.id === activeNodeId;
            const iso = node.updated_at || node.created_at;
            const dateStr = iso
              ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : '';
            const tag0 = (node.tags && node.tags[0]) || '';
            return (
              <li key={node.id} className="ns-row">
                <button
                  type="button"
                  onClick={() => handleSelect(node)}
                  className={`ns-item ${active ? 'is-active' : ''}`}
                >
                  <p className="ns-item-title">{node.title || 'Untitled'}</p>
                  <p className="ns-item-snippet">{snippetFromNode(node) || '—'}</p>
                  <div className="ns-item-meta">
                    <span className="ns-item-date">{dateStr}</span>
                    {tag0 ? <span className="ns-tag-pill">{tag0}</span> : null}
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
                  className="ns-del"
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
    <aside className="note-sidebar">
      <div className="note-sidebar-search">
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
        />
      </div>
      <div className="note-sidebar-toolbar">
        <span className="mono" style={{ fontSize: '11px', color: 'var(--text2)' }}>{total} notes</span>
        <button
          type="button"
          onClick={handleNewNote}
          disabled={createNode.isPending || !brainId}
          className="ns-new-btn"
          title="New note"
        >
          +
        </button>
      </div>
      {createError ? <p style={{ padding: '0 0.75rem', fontSize: '0.75rem', color: '#ff6b6b' }}>{createError}</p> : null}
      <div className="note-sidebar-filters">
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Recent</option>
          <option value="alpha">A–Z</option>
        </select>
        <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} style={{ flex: 1, minWidth: 0 }}>
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <nav className="note-sidebar-nav">
        <p className="note-sidebar-brain-name" title={brain?.name}>
          {brain?.name || '…'}
        </p>
        <Section label="TODAY" items={grouped.today} />
        <Section label="YESTERDAY" items={grouped.yesterday} />
        <Section label="THIS WEEK" items={grouped.week} />
        <Section label="OLDER" items={grouped.older} />
        {nodes.length === 0 ? <p style={{ padding: '0 0.75rem', fontSize: '0.875rem', color: 'var(--text3)' }}>No notes match.</p> : null}
      </nav>
    </aside>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBrainStore } from '../../store/brainStore';
import { useBrainSources, useNode, useDeleteSource } from '../../api/brainQueries';

const TABS = [
  { id: 'related', label: 'Related' },
  { id: 'sources', label: 'Sources' },
  { id: 'info', label: 'Info' },
];

function SimilarityBar({ score }) {
  const pct = Math.min(100, Math.round((score || 0) * 100));
  const color = pct >= 85 ? 'var(--teal)' : pct >= 75 ? 'var(--accent)' : 'var(--amber)';
  return (
    <div className="h-1.5 w-full rounded-full bg-[color:var(--hairline)] overflow-hidden mt-1">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function ContextPanel({ nodeId }) {
  const { brainId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('related');
  const [backlinks, setBacklinks] = useState([]);
  const [related, setRelated] = useState([]);
  const { fetchBacklinks, fetchRelated } = useBrainStore();
  const { data: node } = useNode(nodeId);
  const { data: sources = [] } = useBrainSources(brainId);
  const deleteSource = useDeleteSource(brainId);

  useEffect(() => {
    if (!nodeId) {
      setBacklinks([]);
      setRelated([]);
      return;
    }
    let cancelled = false;
    Promise.all([fetchBacklinks(nodeId), fetchRelated(nodeId)])
      .then(([bl, rel]) => {
        if (!cancelled) {
          setBacklinks(bl.backlinks || []);
          setRelated(rel.related || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBacklinks([]);
          setRelated([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId, node?.updated_at, fetchBacklinks, fetchRelated]);

  const goTo = (id) => navigate(`/brain/${brainId}/notes/${id}`);

  const sourceForNote =
    node?.source_file_id != null ? sources.find((s) => s.id === node.source_file_id) : null;

  const allTags = new Set(node?.tags || []);
  related.forEach((r) => (r.tags || []).forEach((t) => t && allTags.add(t)));

  if (!nodeId) {
    return (
      <aside
        className="w-[260px] shrink-0 border-l border-[color:var(--hairline)] flex flex-col overflow-hidden"
        style={{ background: 'var(--bg2)' }}
      >
        <div className="p-3 border-b border-[color:var(--hairline)]">
          <h3 className="mono text-[10px] text-[var(--text3)]">CONTEXT</h3>
        </div>
        <p className="p-4 text-sm text-[var(--text3)]">Open a note to see related ideas and sources.</p>
      </aside>
    );
  }

  return (
    <aside
      className="w-[260px] shrink-0 border-l border-[color:var(--hairline)] flex flex-col overflow-hidden"
      style={{ background: 'var(--bg2)' }}
    >
      <div className="flex border-b border-[color:var(--hairline)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-medium border-b-2 ${
              tab === t.id ? 'text-[var(--accent)] border-[var(--accent)]' : 'text-[var(--text3)] border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {tab === 'related' && (
          <>
            <div className="rounded-xl border border-[color:var(--hairline)] bg-[var(--bg3)] p-3">
              <p className="mono text-[10px] text-[var(--accent)] mb-2">✦ AUTO-GENERATED</p>
              <p className="text-sm text-[var(--text2)] leading-relaxed">
                {node?.summary || 'No summary yet. Atlus will show extracted summaries when available from ingestion.'}
              </p>
            </div>
            <div>
              <h4 className="mono text-[10px] text-[var(--text3)] mb-2">RELATED NOTES</h4>
              <ul className="space-y-3">
                {related.length === 0 && <li className="text-xs text-[var(--text3)]">None yet</li>}
                {related.map((n) => {
                  const sc = typeof n.similarity === 'number' ? n.similarity : 0.72;
                  return (
                    <li key={n.id}>
                      <button type="button" onClick={() => goTo(n.id)} className="w-full text-left">
                        <span className="text-sm text-[var(--text1)] line-clamp-2">{n.title || 'Untitled'}</span>
                        <SimilarityBar score={sc} />
                        <span className="mono text-[10px] text-[var(--text3)]">{Math.round(sc * 100)}% match</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            {backlinks.length > 0 ? (
              <div>
                <h4 className="mono text-[10px] text-[var(--text3)] mb-2">BACKLINKS</h4>
                <ul className="space-y-1">
                  {backlinks.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => goTo(n.id)} className="text-sm text-[var(--accent)] hover:underline truncate block w-full text-left">
                        {n.title || 'Untitled'}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div>
              <h4 className="mono text-[10px] text-[var(--text3)] mb-2">TAGS</h4>
              <div className="flex flex-wrap gap-1">
                {[...allTags].slice(0, 16).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="text-[11px] px-2 py-0.5 rounded-full border border-[color:var(--hairline)] text-[var(--text2)] hover:border-[color:var(--accent-40)] hover:text-[var(--accent)]"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'sources' && (
          <div>
            <h4 className="mono text-[10px] text-[var(--text3)] mb-2">INGESTED FILES</h4>
            <ul className="space-y-2">
              {sources.length === 0 && <li className="text-xs text-[var(--text3)]">No sources in this brain yet.</li>}
              {sources.map((s) => (
                <li
                  key={s.id}
                  className={`rounded-lg border px-2 py-2 text-xs flex flex-wrap items-center gap-2 ${
                    sourceForNote && s.id === sourceForNote.id ? 'border-[color:var(--accent-40)] bg-[var(--accent-glow)]' : 'border-[color:var(--hairline)] bg-[var(--bg3)]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="mono text-[var(--teal)] mr-2">{s.file_type || 'file'}</span>
                    <span className="text-[var(--text1)] break-words">{s.filename}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!brainId || deleteSource.isPending}
                    onClick={() => {
                      if (!brainId) return;
                      if (!window.confirm(`Remove “${s.filename}” from this brain?`)) return;
                      deleteSource.mutate(s.id);
                    }}
                    className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-red-400/90 hover:text-red-300 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'info' && node && (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="mono text-[10px] text-[var(--text3)]">CREATED</dt>
              <dd className="text-[var(--text2)]">{node.created_at ? new Date(node.created_at).toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt className="mono text-[10px] text-[var(--text3)]">UPDATED</dt>
              <dd className="text-[var(--text2)]">{node.updated_at ? new Date(node.updated_at).toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt className="mono text-[10px] text-[var(--text3)]">BRAIN</dt>
              <dd className="text-[var(--text2)] mono text-xs">{brainId}</dd>
            </div>
            <div>
              <dt className="mono text-[10px] text-[var(--text3)]">NODE ID</dt>
              <dd className="text-[var(--text2)] mono text-[10px] break-all">{node.id}</dd>
            </div>
            <div>
              <dt className="mono text-[10px] text-[var(--text3)]">WORDS (approx)</dt>
              <dd className="text-[var(--text2)]">
                {(node.markdown_content || '').trim().split(/\s+/).filter(Boolean).length}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </aside>
  );
}

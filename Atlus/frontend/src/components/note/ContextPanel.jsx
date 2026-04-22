import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useBrainSources, useNode, useDeleteSource } from '../../api/brainQueries';

const TABS = [
  { id: 'sources', label: 'Sources' },
  { id: 'info', label: 'Info' },
];

export default function ContextPanel({ nodeId }) {
  const { brainId } = useParams();
  const [tab, setTab] = useState('sources');
  const { data: node } = useNode(nodeId);
  const { data: sources = [] } = useBrainSources(brainId);
  const deleteSource = useDeleteSource(brainId);

  const sourceForNote =
    node?.source_file_id != null ? sources.find((s) => s.id === node.source_file_id) : null;

  if (!nodeId) {
    return (
      <aside className="context-aside">
        <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--hairline)' }}>
          <h3 className="mono context-section-title" style={{ margin: 0 }}>CONTEXT</h3>
        </div>
        <p style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text3)' }}>Open a note to see sources and details.</p>
      </aside>
    );
  }

  return (
    <aside className="context-aside">
      <div className="context-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`context-tab ${tab === t.id ? 'is-on' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="context-body">
        {tab === 'sources' && (
          <div>
            <h4 className="context-section-title">INGESTED FILES</h4>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {sources.length === 0 && <li style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>No sources in this brain yet.</li>}
              {sources.map((s) => (
                <li
                  key={s.id}
                  className={`source-row ${sourceForNote && s.id === sourceForNote.id ? 'is-linked' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="source-type">{s.file_type || 'file'}</span>
                    <span style={{ color: 'var(--text1)', wordBreak: 'break-word' }}>{s.filename}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!brainId || deleteSource.isPending}
                    onClick={() => {
                      if (!brainId) return;
                      if (!window.confirm(`Remove “${s.filename}” from this brain?`)) return;
                      deleteSource.mutate(s.id);
                    }}
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: '#f87171',
                      border: 'none',
                      background: 'none',
                      cursor: !brainId || deleteSource.isPending ? 'not-allowed' : 'pointer',
                      opacity: !brainId || deleteSource.isPending ? 0.4 : 1,
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'info' && node && (
          <div>
            {node.summary ? (
              <div className="panel-inset" style={{ marginBottom: '1rem' }}>
                <p className="context-section-title">SUMMARY</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>{node.summary}</p>
              </div>
            ) : null}
            <div>
              <h4 className="context-section-title">TAGS</h4>
              <div className="flex flex-wrap gap-1">
                {(node.tags || []).slice(0, 16).map((t) => (
                  <span key={t} className="tag-pill">
                    {t}
                  </span>
                ))}
                {(!node.tags || node.tags.length === 0) && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>No tags</span>
                )}
              </div>
            </div>
            <dl style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <dt className="context-section-title">CREATED</dt>
                <dd style={{ margin: 0, color: 'var(--text2)' }}>{node.created_at ? new Date(node.created_at).toLocaleString() : '—'}</dd>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <dt className="context-section-title">UPDATED</dt>
                <dd style={{ margin: 0, color: 'var(--text2)' }}>{node.updated_at ? new Date(node.updated_at).toLocaleString() : '—'}</dd>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <dt className="context-section-title">BRAIN</dt>
                <dd className="mono" style={{ margin: 0, color: 'var(--text2)', fontSize: '0.75rem' }}>{brainId}</dd>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <dt className="context-section-title">NOTE ID</dt>
                <dd className="mono" style={{ margin: 0, color: 'var(--text2)', fontSize: '10px', wordBreak: 'break-all' }}>{node.id}</dd>
              </div>
              <div>
                <dt className="context-section-title">WORDS (approx)</dt>
                <dd style={{ margin: 0, color: 'var(--text2)' }}>
                  {(node.markdown_content || '').trim().split(/\s+/).filter(Boolean).length}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </aside>
  );
}

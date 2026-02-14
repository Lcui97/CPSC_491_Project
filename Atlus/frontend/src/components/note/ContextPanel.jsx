import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBrainStore } from '../../store/brainStore';

export default function ContextPanel({ nodeId }) {
  const { brainId } = useParams();
  const navigate = useNavigate();
  const [backlinks, setBacklinks] = useState([]);
  const [related, setRelated] = useState([]);
  const { fetchBacklinks, fetchRelated } = useBrainStore();

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
        if (!cancelled) setBacklinks([]); setRelated([]);
      });
    return () => { cancelled = true; };
  }, [nodeId, fetchBacklinks, fetchRelated]);

  const goTo = (id) => navigate(`/brain/${brainId}/notes/${id}`);

  return (
    <aside className="w-56 shrink-0 border-l border-[rgb(var(--border))] bg-[rgb(var(--panel))] flex flex-col overflow-hidden">
      <div className="p-3 border-b border-[rgb(var(--border))]">
        <h3 className="text-xs font-semibold uppercase text-[rgb(var(--muted))]">Context</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <section>
          <h4 className="text-xs font-medium text-[rgb(var(--muted))] mb-2">Backlinks</h4>
          <ul className="space-y-1">
            {backlinks.length === 0 && <li className="text-xs text-[rgb(var(--muted))]">None</li>}
            {backlinks.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => goTo(n.id)}
                  className="text-sm text-[rgb(var(--accent))] hover:underline truncate block w-full text-left"
                >
                  {n.title || 'Untitled'}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="text-xs font-medium text-[rgb(var(--muted))] mb-2">Related</h4>
          <ul className="space-y-1">
            {related.length === 0 && <li className="text-xs text-[rgb(var(--muted))]">None</li>}
            {related.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => goTo(n.id)}
                  className="text-sm text-[rgb(var(--accent))] hover:underline truncate block w-full text-left"
                >
                  {n.title || 'Untitled'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}

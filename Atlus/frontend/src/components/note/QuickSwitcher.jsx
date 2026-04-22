import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function QuickSwitcher() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [brains, setBrains] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        setQ('');
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => {
      setOpen(true);
      setQ('');
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('atlus-open-quick-switcher', onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('atlus-open-quick-switcher', onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    api('/api/brain/list').then((r) => setBrains(r.brains || [])).catch(() => setBrains([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!q.trim()) {
      setResults(brains.map((b) => ({ type: 'brain', id: b.id, title: b.name, brainId: b.id })));
      return;
    }
    setLoading(true);
    api(`/api/brain/search?q=${encodeURIComponent(q)}`)
      .then((r) => setResults((r.results || []).map((n) => ({ type: 'node', id: n.id, title: n.title, brainId: n.brain_id }))))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [open, q, brains]);

  const handleSelect = useCallback((item) => {
    if (item.type === 'brain') {
      navigate(`/brain/${item.brainId}/notes`);
    } else {
      navigate(`/brain/${item.brainId}/notes/${item.id}`);
    }
    setOpen(false);
  }, [navigate]);

  if (!open) return null;

  return (
    <div className="qs-overlay" onClick={() => setOpen(false)}>
      <div
        className="qs-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search brains and notes…"
          className="qs-input"
          autoFocus
        />
        <ul className="qs-list">
          {loading && <li className="text-muted" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Searching…</li>}
          {!loading && results.length === 0 && <li className="text-muted" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>No results</li>}
          {results.map((item) => (
            <li key={item.type + item.id}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
              >
                <span className="mono" style={{ fontSize: '10px', color: 'var(--text3)' }}>{item.type === 'brain' ? 'Brain' : 'Note'}</span>
                {item.title || 'Untitled'}
              </button>
            </li>
          ))}
        </ul>
        <p className="qs-footer">
          ⌘K to toggle · Esc to close
        </p>
      </div>
    </div>
  );
}

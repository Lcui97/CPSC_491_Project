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
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50" onClick={() => setOpen(false)}>
      <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl shadow-xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search brains and notes…"
          className="w-full px-4 py-3 bg-transparent border-b border-[rgb(var(--border))] text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none"
          autoFocus
        />
        <ul className="max-h-72 overflow-y-auto py-2">
          {loading && <li className="px-4 py-2 text-sm text-[rgb(var(--muted))]">Searching…</li>}
          {!loading && results.length === 0 && <li className="px-4 py-2 text-sm text-[rgb(var(--muted))]">No results</li>}
          {results.map((item) => (
            <li key={item.type + item.id}>
              <button type="button" onClick={() => handleSelect(item)} className="w-full text-left px-4 py-2 text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))] flex items-center gap-2">
                <span className="text-[rgb(var(--muted))]">{item.type === 'brain' ? 'Brain' : 'Note'}</span>
                {item.title || 'Untitled'}
              </button>
            </li>
          ))}
        </ul>
        <p className="px-4 py-2 text-xs text-[rgb(var(--muted))] border-t border-[rgb(var(--border))]">⌘K to toggle · Esc to close</p>
      </div>
    </div>
  );
}

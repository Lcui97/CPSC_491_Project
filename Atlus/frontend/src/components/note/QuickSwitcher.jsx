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
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-[color:var(--veil)]" onClick={() => setOpen(false)}>
      <div
        className="border rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search brains and notes…"
          className="w-full px-4 py-3 bg-transparent border-b text-[var(--text1)] placeholder:text-[var(--text3)] focus:outline-none"
          style={{ borderColor: 'var(--border2)' }}
          autoFocus
        />
        <ul className="max-h-72 overflow-y-auto py-2">
          {loading && <li className="px-4 py-2 text-sm text-[var(--text3)]">Searching…</li>}
          {!loading && results.length === 0 && <li className="px-4 py-2 text-sm text-[var(--text3)]">No results</li>}
          {results.map((item) => (
            <li key={item.type + item.id}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-2 text-sm text-[var(--text1)] hover:bg-[var(--bg4)] flex items-center gap-2"
              >
                <span className="mono text-[10px] text-[var(--text3)]">{item.type === 'brain' ? 'Brain' : 'Note'}</span>
                {item.title || 'Untitled'}
              </button>
            </li>
          ))}
        </ul>
        <p className="px-4 py-2 text-xs text-[var(--text3)] border-t mono" style={{ borderColor: 'var(--border2)' }}>
          ⌘K to toggle · Esc to close
        </p>
      </div>
    </div>
  );
}

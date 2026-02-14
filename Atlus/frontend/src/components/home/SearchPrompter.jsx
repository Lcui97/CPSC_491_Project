import { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client';

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const BRAINS_STORAGE_KEY = 'atlus_brains';
const NOTES_STORAGE_PREFIX = 'atlus_brain_notes_';

function searchNotesInStorage(q) {
  const lower = q.toLowerCase();
  const brains = (() => {
    try {
      const s = localStorage.getItem(BRAINS_STORAGE_KEY);
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  })();
  const out = [];
  brains.forEach((brain) => {
    try {
      const data = localStorage.getItem(`${NOTES_STORAGE_PREFIX}${brain.id}`);
      const notes = data ? JSON.parse(data) : [];
      notes.forEach((note) => {
        const match = (note.title || '').toLowerCase().includes(lower) || (note.content || '').toLowerCase().includes(lower);
        if (match) out.push({ id: `note-${brain.id}-${note.id}`, title: note.title, summary: note.content?.slice(0, 300), brain_id: brain.id, brain_name: brain.name, type: 'note' });
      });
    } catch (_) {}
  });
  return out;
}

export default function SearchPrompter({ onSelectNode, className = '' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('');
      setQuery((prev) => (e.results[e.results.length - 1].isFinal ? transcript : prev + transcript));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try { recognitionRef.current?.abort(); } catch (_) {}
    };
  }, []);

  const startListening = () => {
    if (!SpeechRecognition || listening) return;
    setError(null);
    try {
      recognitionRef.current?.start();
      setListening(true);
    } catch (e) {
      setError('Speech not supported or microphone blocked');
      setListening(false);
    }
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
    setListening(false);
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    const noteResults = searchNotesInStorage(q);
    try {
      const res = await api(`/api/brain/search?q=${encodeURIComponent(q)}`);
      const nodeResults = (res.results || []).map((r) => ({ ...r, type: 'node' }));
      setResults([...noteResults, ...nodeResults]);
    } catch (e) {
      setError(e.message || 'Search failed');
      setResults(noteResults);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-2 rounded-2xl bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-[rgb(var(--accent))] focus-within:border-[rgb(var(--accent))] transition-all">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search your brains and notes…"
          className="flex-1 min-w-0 bg-transparent text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none text-sm"
          aria-label="Search"
        />
        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          title={listening ? 'Stop listening' : 'Speech to text'}
          className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
            listening
              ? 'bg-red-500/20 text-red-600'
              : 'text-[rgb(var(--muted))] hover:bg-[rgb(var(--accent))]/10 hover:text-[rgb(var(--accent))]'
          }`}
        >
          {listening ? (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="shrink-0 py-1.5 px-3 rounded-xl bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 px-1">{error}</p>
      )}

      {results.length > 0 && (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--panel))] overflow-hidden shadow-sm max-h-64 overflow-y-auto">
          <p className="text-xs font-medium text-[rgb(var(--muted))] px-3 py-2 border-b border-[rgb(var(--border))]">
            Results
          </p>
          <ul className="divide-y divide-[rgb(var(--border))]">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode?.(r)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[rgb(var(--panel2))] transition-colors"
                >
                  <p className="text-sm font-medium text-[rgb(var(--text))]">{r.title}</p>
                  {r.summary && (
                    <p className="text-xs text-[rgb(var(--muted))] mt-0.5 line-clamp-2">{r.summary}</p>
                  )}
                  <p className="text-[10px] text-[rgb(var(--muted))] mt-1">
                    {r.type === 'note' ? 'Note' : 'Node'} in {r.brain_name || '—'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {query && !searching && results.length === 0 && (
        <p className="text-sm text-[rgb(var(--muted))] px-1">No matches. Try different words or add more to your brains.</p>
      )}
    </div>
  );
}

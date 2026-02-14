import { useState, useEffect } from 'react';

const NOTES_STORAGE_PREFIX = 'atlus_brain_notes_';

function loadNotes(brainId) {
  try {
    const data = localStorage.getItem(`${NOTES_STORAGE_PREFIX}${brainId}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveNotes(brainId, notes) {
  localStorage.setItem(`${NOTES_STORAGE_PREFIX}${brainId}`, JSON.stringify(notes));
}

export default function BrainNotesView({ brain, onBack }) {
  const [notes, setNotes] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    if (brain) setNotes(loadNotes(brain.id));
  }, [brain?.id]);

  useEffect(() => {
    if (brain) saveNotes(brain.id, notes);
  }, [brain?.id, notes]);

  function addNote() {
    if (!newTitle.trim()) return;
    const note = {
      id: String(Date.now()),
      title: newTitle.trim(),
      content: newContent.trim(),
    };
    setNotes((prev) => [...prev, note]);
    setNewTitle('');
    setNewContent('');
    setAdding(false);
  }

  function removeNote(id) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  if (!brain) return null;

  return (
    <div className="w-full h-full flex flex-col bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--border))]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] text-sm"
          >
            ← Back
          </button>
          <h2 className="font-semibold text-[rgb(var(--text))]">{brain.name}</h2>
          <span className="text-xs text-[rgb(var(--muted))]">{brain.badge}</span>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="py-1.5 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium transition-colors"
        >
          Add note
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {adding && (
          <div className="p-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] space-y-3">
            <input
              type="text"
              placeholder="Note title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border))] text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
            />
            <textarea
              placeholder="Content (optional)"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border))] text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))] resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addNote}
                className="py-1.5 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewTitle(''); setNewContent(''); }}
                className="py-1.5 px-3 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {notes.length === 0 && !adding ? (
          <p className="text-[rgb(var(--muted))] text-sm">No notes yet. Add a note to get started.</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--panel2))]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-[rgb(var(--text))]">{note.title}</h3>
                <button
                  type="button"
                  onClick={() => removeNote(note.id)}
                  className="shrink-0 text-xs text-[rgb(var(--muted))] hover:text-red-500"
                >
                  Remove
                </button>
              </div>
              {note.content && (
                <p className="mt-1 text-sm text-[rgb(var(--muted))] whitespace-pre-wrap">
                  {note.content}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

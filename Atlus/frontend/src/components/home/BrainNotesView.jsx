import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrainNodes, useCreateNode } from '../../api/brainQueries';

export default function BrainNotesView({ brain, onBack }) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [error, setError] = useState('');

  const { data: listData, refetch } = useBrainNodes(brain?.id, { page: 1, per_page: 50 });
  const createNode = useCreateNode(brain?.id);

  const notes = listData?.nodes ?? [];

  function handleAddNote() {
    setError('');
    if (!newTitle.trim()) return;
    const title = newTitle.trim();
    const markdown_content = newContent.trim()
      ? `# ${title}\n\n${newContent.trim()}`
      : `# ${title}\n\nStart writing here.`;
    createNode.mutate(
      {
        title,
        markdown_content,
        tags: [],
        node_type: 'note',
      },
      {
        onSuccess: (data) => {
          setNewTitle('');
          setNewContent('');
          setAdding(false);
          refetch();
          navigate(`/brain/${brain.id}/notes/${data.id}`);
        },
        onError: (err) => {
          setError(err.message || 'Failed to create note');
        },
      }
    );
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
          onClick={() => { setAdding(true); setError(''); }}
          className="py-1.5 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium transition-colors"
        >
          Add note
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
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
                onClick={handleAddNote}
                disabled={createNode.isPending}
                className="py-1.5 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm disabled:opacity-50"
              >
                {createNode.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewTitle(''); setNewContent(''); setError(''); }}
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
                <button
                  type="button"
                  onClick={() => navigate(`/brain/${brain.id}/notes/${note.id}`)}
                  className="text-left flex-1 min-w-0"
                >
                  <h3 className="font-medium text-[rgb(var(--text))] truncate">{note.title || 'Untitled'}</h3>
                </button>
              </div>
              {(note.markdown_content || note.summary) && (
                <p className="mt-1 text-sm text-[rgb(var(--muted))] line-clamp-2">
                  {(note.summary || note.markdown_content || '').replace(/#/g, '').trim().slice(0, 120)}…
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

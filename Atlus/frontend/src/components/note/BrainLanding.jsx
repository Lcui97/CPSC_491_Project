import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useBrainSources, useBrainAsk, useDeleteSource } from '../../api/brainQueries';

export default function BrainLanding() {
  const { brainId } = useParams();
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState(null);

  const { data: sources = [], refetch: refetchSources, isFetching: sourcesFetching } = useBrainSources(brainId);
  const askMutation = useBrainAsk(brainId);
  const deleteSource = useDeleteSource(brainId);

  async function handleAsk(mode = 'summary') {
    if (!brainId) return;
    setResponse(null);
    const userPrompt = prompt.trim() || (mode === 'summary' ? 'Summarize the above.' : '');
    try {
      const data = await askMutation.mutateAsync({ prompt: userPrompt, mode });
      setResponse(data?.response || '');
    } catch (err) {
      setResponse(`Error: ${err.message || 'Request failed'}`);
    }
  }

  function handlePromptSubmit(e) {
    e.preventDefault();
    if (prompt.trim()) handleAsk('custom');
    else handleAsk('summary');
  }

  return (
    <div className="flex-1 overflow-auto min-h-0 flex flex-col">
      <div className="max-w-2xl mx-auto w-full p-6 space-y-8">
        <section>
          <h1 className="text-xl font-semibold text-[rgb(var(--text))] mb-2">Welcome to your brain</h1>
          <p className="text-sm text-[rgb(var(--muted))] mb-2">
            Choose a note in the sidebar to open it. Handwritten scans show the image on the left and Markdown on the right.
          </p>
        </section>

        <section className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-semibold text-[rgb(var(--text))]">Sources in this brain</h2>
            <button
              type="button"
              onClick={() => refetchSources()}
              disabled={sourcesFetching}
              className="text-xs font-medium text-[rgb(var(--accent))] hover:underline disabled:opacity-50"
            >
              {sourcesFetching ? 'Refreshing…' : 'Refresh sources'}
            </button>
          </div>
          {sources.length === 0 ? (
            <p className="text-sm text-[rgb(var(--muted))]">No sources linked to this brain yet.</p>
          ) : (
            <ul className="space-y-2">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-sm text-[rgb(var(--text))]"
                >
                  <span className="truncate flex-1 min-w-0">{s.filename}</span>
                  <span className="text-[rgb(var(--muted))] text-xs shrink-0">{s.file_type}</span>
                  <button
                    type="button"
                    disabled={deleteSource.isPending}
                    onClick={() => {
                      if (!window.confirm(`Remove source “${s.filename}” from this brain? Notes stay; only the file link is removed.`))
                        return;
                      deleteSource.mutate(s.id);
                    }}
                    className="shrink-0 text-xs font-medium text-red-400/90 hover:text-red-300 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[rgb(var(--text))] mb-2">Ask your brain</h2>
          <p className="text-sm text-[rgb(var(--muted))] mb-3">Get summaries, study guides, or key points from your notes.</p>
          <form
            onSubmit={handlePromptSubmit}
            className="flex gap-2 items-center rounded-xl bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] px-3 py-2 focus-within:ring-2 focus-within:ring-[rgb(var(--accent))]"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything about your notes..."
              className="flex-1 min-w-0 bg-transparent text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none text-sm py-1"
            />
            <button
              type="submit"
              disabled={askMutation.isPending}
              className="shrink-0 p-2 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] disabled:opacity-50 text-white"
              title="Send"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => handleAsk('summary')}
              disabled={askMutation.isPending}
              className="py-1.5 px-3 rounded-full bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]/50 disabled:opacity-50 text-xs font-medium"
            >
              Summarize
            </button>
            <button
              type="button"
              onClick={() => handleAsk('study_guide')}
              disabled={askMutation.isPending}
              className="py-1.5 px-3 rounded-full bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]/50 disabled:opacity-50 text-xs font-medium"
            >
              Study guide
            </button>
            <button
              type="button"
              onClick={() => handleAsk('key_points')}
              disabled={askMutation.isPending}
              className="py-1.5 px-3 rounded-full bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]/50 disabled:opacity-50 text-xs font-medium"
            >
              Key points
            </button>
          </div>
          {response !== null && (
            <div className="mt-4 p-4 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))]">
              <div className="text-sm text-[rgb(var(--text))] whitespace-pre-wrap">{response}</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useBrainAsk } from '../../api/brainQueries';

/**
 * ChatGPT-style Q&A over one brain’s notes (same API as Brain landing “Ask your brain”).
 */
export default function HomeNotesChat({ activeBrain, brains = [], onSelectBrain }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const effectiveBrainId = activeBrain?.id || brains[0]?.id || '';
  const contextName = activeBrain?.name || brains[0]?.name || 'your notes';

  const askMutation = useBrainAsk(effectiveBrainId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, askMutation.isPending]);

  const send = useCallback(
    async (mode, textOverride = null) => {
      const text = (textOverride ?? input).trim();
      const userPrompt =
        text ||
        (mode === 'summary' ? 'Summarize my notes.' : mode === 'study_guide' ? 'Create a study guide.' : 'List key points.');
      if (!effectiveBrainId && !text) return;

      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: userPrompt }]);

      try {
        const data = await askMutation.mutateAsync({ prompt: userPrompt, mode });
        const reply = data?.response ?? '';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply || '—' }]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `**Error:** ${err.message || 'Request failed'}` },
        ]);
      }
    },
    [askMutation, effectiveBrainId, input]
  );

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || askMutation.isPending) return;
    send('custom', input.trim());
  }

  return (
    <div className="w-full flex flex-col shrink-0 min-h-[320px] max-h-[min(52vh,560px)] rounded-xl border border-[color:var(--hairline)] bg-[var(--bg2)] overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-[color:var(--hairline)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text1)]">Talk to your notes</h2>
          <p className="text-[11px] text-[var(--text3)] mt-0.5">
            Context: <span className="text-[var(--accent)]">{contextName}</span>
            {brains.length > 1 ? ' — click a brain in the sidebar or pick below' : ''}
          </p>
        </div>
        {brains.length > 1 && onSelectBrain ? (
          <select
            value={effectiveBrainId}
            onChange={(e) => {
              const b = brains.find((x) => x.id === e.target.value);
              if (b) onSelectBrain(b);
            }}
            className="text-xs rounded-lg border border-[color:var(--hairline)] bg-[var(--bg3)] text-[var(--text1)] px-2 py-1.5 max-w-[220px]"
          >
            {brains.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {brains.length === 0 ? (
          <p className="text-sm text-[var(--text3)] text-center py-12">
            Create a brain from the sidebar to ask questions about your notes.
          </p>
        ) : !effectiveBrainId ? (
          <p className="text-sm text-[var(--text3)] text-center py-12">Loading brains…</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-sm text-[var(--text2)] mb-1">Ask anything about notes in <span className="text-[var(--accent)]">{contextName}</span>.</p>
            <p className="text-xs text-[var(--text3)]">
              Uses that brain’s notes on the server (needs <code className="text-[10px] px-1 rounded bg-[var(--fill-well)]">OPENAI_API_KEY</code> on the backend).
            </p>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'bg-[var(--accent)] text-white rounded-br-md'
                  : 'bg-[var(--bg3)] border border-[color:var(--hairline)] text-[var(--text1)] rounded-bl-md'
              }`}
            >
              {m.role === 'assistant' ? (
                <div className="prose prose-sm prose-slate max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {askMutation.isPending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-[var(--bg3)] border border-[color:var(--hairline)] text-xs text-[var(--text3)]">
              Thinking…
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 p-3 border-t border-[color:var(--hairline)] bg-[var(--bg3)]/80">
        <div className="flex flex-wrap gap-2 mb-2">
          {[
            { label: 'Summarize', mode: 'summary' },
            { label: 'Study guide', mode: 'study_guide' },
            { label: 'Key points', mode: 'key_points' },
          ].map(({ label, mode }) => (
            <button
              key={mode}
              type="button"
              disabled={!effectiveBrainId || askMutation.isPending}
              onClick={() => send(mode)}
              className="text-xs px-3 py-1 rounded-full border border-[color:var(--hairline-strong)] text-[var(--text2)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] disabled:opacity-40"
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-2xl border border-[color:var(--hairline-strong)] bg-[var(--bg2)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--accent)]/40">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={effectiveBrainId ? 'Message your notes…' : 'Select a brain first…'}
            disabled={!effectiveBrainId || askMutation.isPending}
            className="flex-1 min-h-[44px] max-h-32 resize-y bg-transparent text-[var(--text1)] placeholder:text-[var(--text3)] text-sm py-2.5 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!effectiveBrainId || !input.trim() || askMutation.isPending}
            className="shrink-0 h-10 w-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accentHover)] disabled:opacity-40 text-white flex items-center justify-center"
            title="Send"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

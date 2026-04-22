import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useBrainAsk } from '../../api/brainQueries';

// chat box on home that asks ur notes for whatever class is picked
export default function HomeNotesChat({ activeBrain, brains = [], onSelectBrain }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  const effectiveClassId = activeBrain?.id || brains[0]?.id || '';
  const contextName = activeBrain?.name || brains[0]?.name || 'your notes';

  const askMutation = useBrainAsk(effectiveClassId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, askMutation.isPending]);

  useEffect(() => {
    if (!speakEnabled) return;
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'assistant' || !last.content) return;
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(last.content.replace(/[#*_`>-]/g, ' ').slice(0, 1200));
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [messages, speakEnabled]);

  const send = useCallback(
    async (mode, textOverride = null, extra = {}) => {
      const text = (textOverride ?? input).trim();
      const userPrompt =
        text ||
        (mode === 'summary' ? 'Summarize my notes.' : mode === 'study_guide' ? 'Create a study guide.' : 'List key points.');
      if (!effectiveClassId && !text) return;

      setInput('');
      setMessages((prev) => [...prev, { role: 'user', content: userPrompt }]);

      try {
        const data = await askMutation.mutateAsync({ prompt: userPrompt, mode, ...extra });
        const reply = data?.response ?? '';
        setMessages((prev) => [...prev, { role: 'assistant', content: reply || '—' }]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `**Error:** ${err.message || 'Request failed'}` },
        ]);
      }
    },
    [askMutation, effectiveClassId, input]
  );

  function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || askMutation.isPending) return;
    send('custom', input.trim());
  }

  function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Voice input is not supported in this browser.' }]);
      return;
    }
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (ev) => {
      const transcript = ev?.results?.[0]?.[0]?.transcript || '';
      const text = transcript.trim();
      if (!text) return;
      setInput(text);
      send('custom', text);
    };
    rec.start();
  }

  return (
    <div className="home-notes-chat">
      <div className="home-chat-top">
        <div>
          <h2 className="home-chat-title">Talk to your notes</h2>
          <p className="home-chat-sub">
            Context: <span className="accent">{contextName}</span>
            {brains.length > 1 ? ' — click a class in the sidebar or pick below' : ''}
          </p>
        </div>
        {brains.length > 1 && onSelectBrain ? (
          <select
            value={effectiveClassId}
            onChange={(e) => {
              const b = brains.find((x) => x.id === e.target.value);
              if (b) onSelectBrain(b);
            }}
            className="home-chat-select"
          >
            {brains.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        ) : null}
        <div className="home-chat-tools">
          <button
            type="button"
            onClick={() => setSpeakEnabled((v) => !v)}
            className="home-chat-tool-btn"
            title="Toggle voice playback"
          >
            {speakEnabled ? 'Voice on' : 'Voice off'}
          </button>
          <button
            type="button"
            onClick={startVoiceInput}
            disabled={askMutation.isPending || listening}
            className="home-chat-tool-btn"
            title="Speak to assistant"
          >
            {listening ? 'Listening…' : 'Mic'}
          </button>
        </div>
      </div>

      <div className="home-chat-scroll">
        {brains.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text3)', textAlign: 'center', padding: '0 0 2rem' }}>
            Create a class from the sidebar to ask questions about your notes.
          </p>
        ) : !effectiveClassId ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text3)', textAlign: 'center', padding: '0 0 2rem' }}>Loading classes…</p>
        ) : messages.length === 0 ? (
          <div className="text-center" style={{ padding: '1.5rem 0.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text2)', margin: '0 0 0.25rem' }}>
              Ask anything about notes in <span style={{ color: 'rgb(var(--accent))' }}>{contextName}</span>.
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text3)', margin: 0 }}>
              Uses that class’s notes on the server (needs{' '}
              <code style={{ fontSize: 10, padding: '0.1rem 0.25rem', borderRadius: 4, background: 'var(--bg4)' }}>OPENAI_API_KEY</code>{' '}
              on the backend).
            </p>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} className={`home-chat-row ${m.role === 'user' ? 'is-user' : 'is-assistant'}`}>
            <div className={`home-chat-bubble ${m.role === 'user' ? 'is-user' : 'is-assistant'}`}>
              {m.role === 'assistant' ? (
                <div className="home-chat-md">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {askMutation.isPending ? (
          <div className="home-chat-row is-assistant">
            <div className="home-chat-pending">Thinking…</div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="home-chat-footer">
        <div className="home-chat-chips">
          {[
            { label: 'Summarize', mode: 'summary' },
            { label: 'Study guide', mode: 'study_guide' },
            { label: 'Key points', mode: 'key_points' },
            { label: 'Last 2 weeks', mode: 'custom', extra: { time_scope: 'last_2_weeks' }, prompt: 'Summarize my notes from the past two weeks.' },
            {
              label: 'Upcoming test prep',
              mode: 'custom',
              extra: { response_intent: 'study_for_upcoming', upcoming_days: 21 },
              prompt: 'Help me study for upcoming quizzes/tests using my notes.',
            },
          ].map(({ label, mode, extra, prompt }, idx) => (
            <button
              key={`${mode}-${idx}`}
              type="button"
              disabled={!effectiveClassId || askMutation.isPending}
              onClick={() => send(mode, prompt || null, extra || {})}
              className="home-chat-chip"
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="home-chat-form">
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
            placeholder={effectiveClassId ? 'Message your notes…' : 'Select a class first…'}
            disabled={!effectiveClassId || askMutation.isPending}
            className="home-chat-textarea"
          />
          <button
            type="submit"
            disabled={!effectiveClassId || !input.trim() || askMutation.isPending}
            className="home-chat-send"
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

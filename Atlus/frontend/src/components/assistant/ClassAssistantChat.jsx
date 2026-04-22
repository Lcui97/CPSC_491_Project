import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useMeSummary, useClassesAssistant } from '../../api/brainQueries';
import { apiAudioTts, apiAudioTranscribe } from '../../api/client';

const UI_MODEL_KEY = 'atlus_assistant_ui_model';
const TTS_VOICE_KEY = 'atlus_assistant_tts_voice';
const READ_ALOUD_KEY = 'atlus_assistant_read_aloud';

function stripForSpeech(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#*_>\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3800);
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

/** Pacific time for message headers (America/Los_Angeles). */
function formatMessageTimePacific(ts) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(ts);
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export function IconAssistantPerson(props) {
  const { className = '' } = props;
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.2-4 14.8-4 16 0" />
    </svg>
  );
}

function IconMic(props) {
  const { className = '' } = props;
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v4" />
      <path d="M8 22h8" />
    </svg>
  );
}

/** Shared class planner assistant UI — full page or embedded slide-over. */
export default function ClassAssistantChat({ embedded = false }) {
  const { data: me } = useMeSummary();
  const classAssistant = useClassesAssistant();

  const displayName = me?.display_name || (me?.email ? me.email.split('@')[0] : 'there');

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [uiModel, setUiModel] = useState(() => localStorage.getItem(UI_MODEL_KEY) || 'gpt-4o-mini');
  const [ttsVoice, setTtsVoice] = useState(() => localStorage.getItem(TTS_VOICE_KEY) || 'alloy');
  const [readAloud, setReadAloud] = useState(() => localStorage.getItem(READ_ALOUD_KEY) === '1');
  const [ttsError, setTtsError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const audioRef = useRef(null);
  const bottomRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const chatAbortRef = useRef(null);
  const ttsAbortRef = useRef(null);
  const [assistantOutputActive, setAssistantOutputActive] = useState(false);

  useEffect(() => {
    localStorage.setItem(UI_MODEL_KEY, uiModel);
  }, [uiModel]);

  useEffect(() => {
    localStorage.setItem(TTS_VOICE_KEY, ttsVoice);
  }, [ttsVoice]);

  useEffect(() => {
    localStorage.setItem(READ_ALOUD_KEY, readAloud ? '1' : '0');
  }, [readAloud]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, classAssistant.isPending, assistantOutputActive]);

  function stopAssistantOutput() {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
        const u = a.src;
        if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
    setAssistantOutputActive(false);
    classAssistant.reset();
  }

  function stopMicStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(
    () => () => {
      stopMicStream();
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      } catch {
        // ignore
      }
    },
    []
  );

  function startBrowserDictation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTtsError('Microphone / speech recognition is not available in this browser.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => {};
    rec.onend = () => {};
    rec.onerror = () => {};
    rec.onresult = (ev) => {
      const transcript = ev?.results?.[0]?.[0]?.transcript || '';
      const t = transcript.trim();
      if (t) setInput((prev) => (prev ? `${prev} ${t}` : t));
    };
    rec.start();
  }

  async function toggleWhisperMic() {
    if (transcribing) return;

    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      startBrowserDictation();
      return;
    }

    setTtsError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      let mime = '';
      for (const m of preferred) {
        if (MediaRecorder.isTypeSupported(m)) {
          mime = m;
          break;
        }
      }
      const options = mime ? { mimeType: mime } : undefined;
      const mr = options ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
      recorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stopMicStream();
        recorderRef.current = null;
        setRecording(false);

        const blobType = mr.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: blobType });
        chunksRef.current = [];

        if (blob.size < 400) {
          setTtsError('Recording too short.');
          return;
        }

        setTranscribing(true);
        setTtsError(null);
        try {
          const data = await apiAudioTranscribe(blob);
          const t = (data?.text || '').trim();
          if (t) setInput((prev) => (prev ? `${prev} ${t}` : t));
        } catch (e) {
          setTtsError(e.message || 'Transcription failed.');
        } finally {
          setTranscribing(false);
        }
      };

      mr.start();
      setRecording(true);
    } catch {
      stopMicStream();
      startBrowserDictation();
    }
  }

  const playTts = useCallback(
    async (plainText) => {
      const text = stripForSpeech(plainText);
      if (!text || !readAloud) return;
      setTtsError(null);
      if (audioRef.current) {
        audioRef.current.pause();
        const prev = audioRef.current.src;
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        audioRef.current = null;
      }
      const ttsAc = new AbortController();
      ttsAbortRef.current = ttsAc;
      setAssistantOutputActive(true);
      try {
        const blob = await apiAudioTts(text, ttsVoice, ttsAc.signal);
        if (ttsAc.signal.aborted) {
          setAssistantOutputActive(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (audioRef.current === audio) audioRef.current = null;
          setAssistantOutputActive(false);
        };
        audio.onerror = () => {
          setTtsError('Could not play audio in this browser.');
          URL.revokeObjectURL(url);
          setAssistantOutputActive(false);
        };
        try {
          await audio.play();
        } catch (playErr) {
          setTtsError(playErr?.message || 'Playback was blocked or failed.');
          URL.revokeObjectURL(url);
          if (audioRef.current === audio) audioRef.current = null;
          setAssistantOutputActive(false);
        }
      } catch (e) {
        if (e?.name === 'AbortError') {
          setAssistantOutputActive(false);
          return;
        }
        setTtsError(e.message || 'Voice reply failed.');
        setAssistantOutputActive(false);
      } finally {
        if (ttsAbortRef.current === ttsAc) ttsAbortRef.current = null;
      }
    },
    [readAloud, ttsVoice]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || classAssistant.isPending) return;
    setTtsError(null);
    setInput('');
    const sentAt = Date.now();
    setMessages((prev) => [...prev, { role: 'user', text: prompt, at: sentAt }]);
    const ac = new AbortController();
    chatAbortRef.current = ac;
    try {
      const res = await classAssistant.mutateAsync({ prompt, signal: ac.signal });
      const reply = res?.response || 'No response.';
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, at: Date.now() }]);
      chatAbortRef.current = null;
      if (readAloud) await playTts(reply);
    } catch (err) {
      chatAbortRef.current = null;
      if (err?.name === 'AbortError') return;
      const msg = err.message || 'Request failed.';
      setMessages((prev) => [...prev, { role: 'assistant', text: msg, at: Date.now() }]);
    }
  }

  const micTitle = recording
    ? 'Stop and send to OpenAI Whisper'
    : transcribing
      ? 'Transcribing…'
      : 'Record with mic (OpenAI Whisper) — click again to stop';

  const rootClass = embedded ? 'assistant-chat-layout assistant-chat-embed' : 'assistant-chat-layout';

  return (
    <div className={rootClass}>
      <div className="assistant-chat-inner">
        <div className={`assistant-greet-row ${embedded ? 'assistant-greet-compact' : ''}`}>
          <span className="assistant-header-person" aria-hidden title="Assistant">
            <IconAssistantPerson className="assistant-header-person-svg" />
          </span>
          <p className="assistant-greet-line">
            {timeGreeting()}, <span className="assistant-name">{displayName}</span>
          </p>
        </div>

        <div className="assistant-transcript-wrap">
          {messages.length === 0 && !classAssistant.isPending ? (
            <p className="assistant-empty-hint">
              Ask about quizzes, deadlines, or your schedule. Messages appear above — type below.
            </p>
          ) : null}
          {messages.map((m, i) => (
            <div key={i} className={`assistant-msg ${m.role === 'user' ? 'user' : 'bot'}`}>
              <div className="assistant-msg-head">
                {m.role === 'user' ? (
                  <strong className="assistant-msg-label assistant-msg-label-you">You</strong>
                ) : (
                  <strong className="assistant-msg-label">
                    <IconAssistantPerson className="assistant-msg-person-ico" />
                    <span>Assistant</span>
                  </strong>
                )}
                {m.at != null ? (
                  <span className="assistant-msg-time" title="Pacific Time (America/Los_Angeles)">
                    {formatMessageTimePacific(m.at)} PT
                  </span>
                ) : null}
              </div>
              {m.role === 'user' ? (
                <div className="assistant-msg-body assistant-msg-body-user">{m.text}</div>
              ) : (
                <div className="assistant-msg-body assistant-msg-md">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
          {classAssistant.isPending ? (
            <div className="assistant-msg bot">
              <div className="assistant-msg-head">
                <strong className="assistant-msg-label">
                  <IconAssistantPerson className="assistant-msg-person-ico" />
                  <span>Assistant</span>
                </strong>
              </div>
              <div className="assistant-msg-body">Thinking…</div>
            </div>
          ) : null}
          <div ref={bottomRef} style={{ height: 1 }} aria-hidden />
        </div>
      </div>

      <div className="assistant-compose-dock">
        <form className="assistant-shell" onSubmit={handleSubmit}>
          <textarea
            className="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="How can I help you today?"
            rows={embedded ? 2 : 2}
            disabled={classAssistant.isPending}
          />
          <div className="assistant-toolbar">
            <button type="button" className="assistant-tool-btn" title="Attachments (not wired yet)" disabled>
              +
            </button>
            <button
              type="button"
              className={`assistant-tool-btn assistant-mic-btn ${recording ? 'is-recording' : ''} ${transcribing ? 'is-busy' : ''}`}
              title={micTitle}
              aria-label={micTitle}
              onClick={() => void toggleWhisperMic()}
              disabled={classAssistant.isPending || transcribing}
            >
              <IconMic className="assistant-mic-svg" />
            </button>
            <div className="assistant-toolbar-spacer" />
            <select
              className="assistant-select"
              value={uiModel}
              onChange={(e) => setUiModel(e.target.value)}
              title="UI preference — server still uses gpt-4o-mini for this assistant"
            >
              <option value="gpt-4o-mini">GPT-4o mini</option>
              <option value="planner">Class planner</option>
            </select>
            <select className="assistant-select" value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} title="OpenAI TTS voice">
              <option value="alloy">Voice: alloy</option>
              <option value="nova">Voice: nova</option>
              <option value="shimmer">Voice: shimmer</option>
              <option value="echo">Voice: echo</option>
            </select>
            <button
              type="button"
              className={`assistant-voice-toggle ${readAloud ? 'is-on' : ''}`}
              title="Read assistant replies aloud (OpenAI TTS)"
              aria-pressed={readAloud}
              onClick={() => setReadAloud((v) => !v)}
            >
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </button>
          </div>
          <div className="assistant-submit-wrap">
            {classAssistant.isPending || assistantOutputActive ? (
              <button
                type="button"
                className="assistant-cancel"
                onClick={stopAssistantOutput}
                title="Stop reply and voice"
              >
                Cancel
              </button>
            ) : null}
            <button type="submit" className="assistant-submit" disabled={classAssistant.isPending || !input.trim()}>
              {classAssistant.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>

        {ttsError ? <p className="assistant-tts-note">{ttsError}</p> : null}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

const MODES = ['edit', 'preview', 'split'];
const DEBOUNCE_MS = 600;

export default function MarkdownEditor({
  value = '',
  onChange,
  onSave,
  placeholder = 'Write in Markdown…',
  readOnly = false,
}) {
  const [mode, setMode] = useState('edit');
  const [local, setLocal] = useState(value);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (onSave && local !== value) onSave(local);
      saveTimeoutRef.current = null;
    }, DEBOUNCE_MS);
  }, [local, value, onSave]);

  useEffect(() => {
    if (readOnly) return;
    scheduleSave();
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [local, readOnly, scheduleSave]);

  const handleChange = (e) => {
    setLocal(e.target.value);
    onChange?.(e.target.value);
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (onSave) onSave(local);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-[rgb(var(--border))] bg-[rgb(var(--panel2))]">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-2 text-sm font-medium capitalize ${mode === m ? 'text-[rgb(var(--accent))] border-b-2 border-[rgb(var(--accent))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]'}`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="flex-1 flex overflow-hidden min-h-0">
        {(mode === 'edit' || mode === 'split') && (
          <div className={mode === 'split' ? 'w-1/2 border-r border-[rgb(var(--border))]' : 'w-full'}>
            <textarea
              value={local}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              readOnly={readOnly}
              className="w-full h-full resize-none p-4 bg-[rgb(var(--bg))] text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none font-mono text-sm"
              spellCheck="false"
            />
          </div>
        )}
        {(mode === 'preview' || mode === 'split') && (
          <div className={`overflow-y-auto p-4 prose prose-sm max-w-none ${mode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <ReactMarkdown
              components={{
                h1: ({ node, ...p }) => <h1 className="text-xl font-bold text-[rgb(var(--text))] mt-4 mb-2" {...p} />,
                h2: ({ node, ...p }) => <h2 className="text-lg font-semibold text-[rgb(var(--text))] mt-3 mb-1" {...p} />,
                h3: ({ node, ...p }) => <h3 className="text-base font-medium text-[rgb(var(--text))] mt-2" {...p} />,
                p: ({ node, ...p }) => <p className="text-[rgb(var(--text))] my-1" {...p} />,
                ul: ({ node, ...p }) => <ul className="list-disc pl-6 my-2 text-[rgb(var(--text))]" {...p} />,
                ol: ({ node, ...p }) => <ol className="list-decimal pl-6 my-2 text-[rgb(var(--text))]" {...p} />,
                code: ({ node, inline, ...p }) =>
                  inline ? <code className="px-1 rounded bg-[rgb(var(--panel2))] text-sm" {...p} /> : <code className="block p-2 rounded bg-[rgb(var(--panel2))] text-sm overflow-x-auto" {...p} />,
                pre: ({ node, ...p }) => <pre className="p-2 rounded bg-[rgb(var(--panel2))] overflow-x-auto my-2" {...p} />,
                table: ({ node, ...p }) => <table className="border-collapse border border-[rgb(var(--border))] my-2 text-sm text-[rgb(var(--text))]" {...p} />,
                th: ({ node, ...p }) => <th className="border border-[rgb(var(--border))] px-2 py-1 bg-[rgb(var(--panel2))]" {...p} />,
                td: ({ node, ...p }) => <td className="border border-[rgb(var(--border))] px-2 py-1" {...p} />,
              }}
            >
              {local || '_No content_'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

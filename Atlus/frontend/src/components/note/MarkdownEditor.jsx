import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

const MODES = ['edit', 'preview', 'split'];
const DEBOUNCE_MS = 600;

function wrapSelection(textarea, before, after = before) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const sel = text.slice(start, end);
  const insertion = before + sel + after;
  const next = text.slice(0, start) + insertion + text.slice(end);
  const newPos = start + insertion.length;
  return { next, newPos };
}

function insertLinePrefix(textarea, prefix) {
  const start = textarea.selectionStart;
  const text = textarea.value;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = text.indexOf('\n', start);
  const end = lineEnd === -1 ? text.length : lineEnd;
  const line = text.slice(lineStart, end);
  const nextLine = line.startsWith(prefix) ? line : `${prefix}${line}`;
  const next = text.slice(0, lineStart) + nextLine + text.slice(end);
  return { next, newPos: lineStart + nextLine.length };
}

function Tb({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-8 min-w-[2rem] px-2 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? 'border-[color:var(--accent-40)] text-[var(--accent)]'
          : 'border-transparent text-[var(--text2)] hover:bg-[var(--bg4)]'
      }`}
      style={active ? { background: 'var(--accent-glow)' } : undefined}
    >
      {children}
    </button>
  );
}

export default function MarkdownEditor({
  value = '',
  onChange,
  onSave,
  placeholder = 'Write in Markdown…',
  readOnly = false,
  title = '',
  onTitleChange,
  onTitleBlur,
  titleInputRef = null,
  metadata = null,
  sourceLabel = '',
  saveStatus = 'idle',
  totalNotesInBrain = null,
}) {
  const [mode, setMode] = useState('split');
  const [local, setLocal] = useState(value);
  const saveTimeoutRef = useRef(null);
  const taRef = useRef(null);

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
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [local, readOnly, scheduleSave]);

  const applyWrap = (before, after) => {
    const el = taRef.current;
    if (!el) return;
    const { next, newPos } = wrapSelection(el, before, after);
    setLocal(next);
    onChange?.(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  };

  const applyLinePrefix = (prefix) => {
    const el = taRef.current;
    if (!el) return;
    const { next, newPos } = insertLinePrefix(el, prefix);
    setLocal(next);
    onChange?.(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  };

  const promptLink = () => {
    const url = window.prompt('Link URL', 'https://');
    if (!url) return;
    const label = window.prompt('Link text', 'link') || 'link';
    applyWrap(`[${label}](`, `${url})`);
  };

  const promptImage = () => {
    const url = window.prompt('Image URL', 'https://');
    if (!url) return;
    const alt = window.prompt('Alt text', 'image') || 'image';
    const el = taRef.current;
    if (!el) return;
    const ins = `![${alt}](${url})`;
    const start = el.selectionStart;
    const text = el.value;
    const next = text.slice(0, start) + ins + text.slice(el.selectionEnd);
    setLocal(next);
    onChange?.(next);
    requestAnimationFrame(() => {
      el.focus();
      const p = start + ins.length;
      el.setSelectionRange(p, p);
    });
  };

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

  const words = local.trim() ? local.trim().split(/\s+/).filter(Boolean).length : 0;
  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : 'Autosave on';

  return (
    <div className="h-full flex flex-col bg-[rgb(var(--bg))]">
      <div
        className="h-[42px] shrink-0 flex items-center gap-1 px-2 border-b border-[color:var(--hairline)] bg-[var(--bg2)] overflow-x-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        <Tb title="Bold" onClick={() => applyWrap('**', '**')}>
          <strong>B</strong>
        </Tb>
        <Tb title="Italic" onClick={() => applyWrap('*', '*')}>
          <em>I</em>
        </Tb>
        <Tb title="Strikethrough" onClick={() => applyWrap('~~', '~~')}>
          <span className="line-through">S</span>
        </Tb>
        <span className="w-px h-5 bg-[color:var(--hairline)] mx-1" />
        <Tb title="Heading 1" onClick={() => applyLinePrefix('# ')}>
          H1
        </Tb>
        <Tb title="Heading 2" onClick={() => applyLinePrefix('## ')}>
          H2
        </Tb>
        <span className="w-px h-5 bg-[color:var(--hairline)] mx-1" />
        <Tb title="Bullet list" onClick={() => applyLinePrefix('- ')}>
          •
        </Tb>
        <Tb title="Numbered list" onClick={() => applyLinePrefix('1. ')}>
          1.
        </Tb>
        <Tb title="Quote" onClick={() => applyLinePrefix('> ')}>
          “
        </Tb>
        <Tb title="Inline code" onClick={() => applyWrap('`', '`')}>
          &lt;/&gt;
        </Tb>
        <span className="w-px h-5 bg-[color:var(--hairline)] mx-1" />
        <Tb title="Link" onClick={promptLink}>
          Link
        </Tb>
        <Tb title="Image" onClick={promptImage}>
          Img
        </Tb>
        <div className="flex-1" />
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`h-8 px-2 rounded-lg text-xs capitalize border ${
              mode === m ? 'text-[var(--accent)] border-[color:var(--accent-40)]' : 'text-[var(--text2)] border-transparent hover:bg-[var(--bg4)]'
            }`}
            style={mode === m ? { background: 'var(--accent-glow)' } : undefined}
          >
            {m}
          </button>
        ))}
      </div>

      {onTitleChange ? (
        <div className="shrink-0 px-6 pt-4 border-b border-[color:var(--hairline-faint)]">
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleBlur}
            placeholder="Note title"
            className="w-full bg-transparent text-[28px] font-semibold leading-tight text-[var(--text1)] placeholder:text-[var(--text3)] focus:outline-none focus:ring-0"
          />
          {metadata ? (
            <div className="flex flex-wrap gap-2 mt-3 pb-3">
              {metadata.dateLabel ? (
                <button type="button" className="mono text-[11px] px-2 py-1 rounded-lg border border-[color:var(--hairline)] text-[var(--text2)] hover:border-[color:var(--accent-40)]">
                  {metadata.dateLabel}
                </button>
              ) : null}
              {metadata.brainName ? (
                <button type="button" className="mono text-[11px] px-2 py-1 rounded-lg border border-[color:var(--hairline)] text-[var(--text2)] hover:border-[color:var(--accent-40)]">
                  {metadata.brainName}
                </button>
              ) : null}
              {(metadata.tags || []).slice(0, 6).map((t) => (
                <span key={t} className="mono text-[11px] px-2 py-1 rounded-[10px] bg-[var(--bg3)] text-[var(--accent)] border border-[color:var(--accent-20)]">
                  {t}
                </span>
              ))}
              {metadata.linkedCount != null ? (
                <button type="button" className="mono text-[11px] px-2 py-1 rounded-lg border border-[color:var(--hairline)] text-[var(--text2)] hover:border-[color:var(--accent-40)]">
                  Linked {metadata.linkedCount}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex-1 flex overflow-hidden min-h-0">
        {(mode === 'edit' || mode === 'split') && (
          <div className={mode === 'split' ? 'w-1/2 border-r border-[color:var(--hairline)]' : 'w-full'}>
            <textarea
              ref={taRef}
              value={local}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              readOnly={readOnly}
              className="atlus-editor-textarea w-full h-full resize-none px-6 py-4 bg-transparent text-[15px] leading-[1.85] text-[var(--text2)] placeholder:text-[var(--text3)] focus:outline-none font-sans"
              spellCheck="false"
            />
          </div>
        )}
        {(mode === 'preview' || mode === 'split') && (
          <div className={`atlus-editor-preview overflow-y-auto px-6 py-4 ${mode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <ReactMarkdown
              components={{
                h1: ({ node, ...p }) => <h1 className="text-2xl font-semibold text-[var(--text1)] mt-4 mb-2" {...p} />,
                h2: ({ node, ...p }) => <h2 className="text-xl font-semibold text-[var(--text1)] mt-3 mb-2" {...p} />,
                h3: ({ node, ...p }) => <h3 className="text-lg font-medium text-[var(--text1)] mt-2 mb-1" {...p} />,
                p: ({ node, ...p }) => <p className="text-[15px] leading-[1.85] text-[var(--text2)] my-2" {...p} />,
                ul: ({ node, ...p }) => <ul className="list-disc pl-6 my-2 text-[var(--text2)]" {...p} />,
                ol: ({ node, ...p }) => <ol className="list-decimal pl-6 my-2 text-[var(--text2)]" {...p} />,
                blockquote: ({ node, ...p }) => (
                  <blockquote
                    className="my-3 pl-4 border-l-2 text-[var(--text2)] italic"
                    style={{ borderColor: 'var(--accent)', fontFamily: "'Lora', serif" }}
                    {...p}
                  />
                ),
                code: ({ node, inline, ...p }) =>
                  inline ? (
                    <code className="px-1 rounded bg-[var(--bg3)] text-sm text-[var(--teal)]" {...p} />
                  ) : (
                    <code className="block p-3 rounded-lg bg-[var(--bg3)] text-sm text-[var(--teal)] overflow-x-auto my-2 mono" {...p} />
                  ),
                pre: ({ node, ...p }) => <pre className="p-0 my-0 bg-transparent" {...p} />,
                table: ({ node, ...p }) => <table className="border-collapse border border-[color:var(--hairline)] my-2 text-sm text-[var(--text2)]" {...p} />,
                th: ({ node, ...p }) => <th className="border border-[color:var(--hairline)] px-2 py-1 bg-[var(--bg3)]" {...p} />,
                td: ({ node, ...p }) => <td className="border border-[color:var(--hairline)] px-2 py-1" {...p} />,
              }}
            >
              {local || '_No content_'}
            </ReactMarkdown>
          </div>
        )}
      </div>

      <div className="h-9 shrink-0 flex items-center justify-between px-6 border-t border-[color:var(--hairline)] bg-[var(--bg2)] text-[11px] text-[var(--text3)]">
        <span className="mono">
          {words} words
          {totalNotesInBrain != null ? ` · ${totalNotesInBrain} notes in brain` : ''}
          {sourceLabel ? ` · ${sourceLabel}` : ''}
        </span>
        <span
          className={`mono ${
            saveStatus === 'saved' ? 'text-[var(--green)]' : saveStatus === 'saving' ? 'text-[var(--amber)]' : 'text-[var(--text3)]'
          }`}
        >
          {saveLabel}
        </span>
      </div>
    </div>
  );
}

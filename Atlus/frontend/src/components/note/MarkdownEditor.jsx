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
      className={`md-tool-btn ${active ? 'is-active' : ''}`}
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
  totalNotesInClass = null,
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
    <div className="md-editor-root">
      <div className="md-toolbar">
        <Tb title="Bold" onClick={() => applyWrap('**', '**')} active={false}>
          <strong>B</strong>
        </Tb>
        <Tb title="Italic" onClick={() => applyWrap('*', '*')} active={false}>
          <em>I</em>
        </Tb>
        <Tb title="Strikethrough" onClick={() => applyWrap('~~', '~~')} active={false}>
          <span className="line-through">S</span>
        </Tb>
        <span className="md-toolbar-sep" />
        <Tb title="Heading 1" onClick={() => applyLinePrefix('# ')} active={false}>
          H1
        </Tb>
        <Tb title="Heading 2" onClick={() => applyLinePrefix('## ')} active={false}>
          H2
        </Tb>
        <span className="md-toolbar-sep" />
        <Tb title="Bullet list" onClick={() => applyLinePrefix('- ')} active={false}>
          •
        </Tb>
        <Tb title="Numbered list" onClick={() => applyLinePrefix('1. ')} active={false}>
          1.
        </Tb>
        <Tb title="Quote" onClick={() => applyLinePrefix('> ')} active={false}>
          “
        </Tb>
        <Tb title="Inline code" onClick={() => applyWrap('`', '`')} active={false}>
          &lt;/&gt;
        </Tb>
        <span className="md-toolbar-sep" />
        <Tb title="Link" onClick={promptLink} active={false}>
          Link
        </Tb>
        <Tb title="Image" onClick={promptImage} active={false}>
          Img
        </Tb>
        <div className="md-toolbar-spacer" />
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`md-mode-btn ${mode === m ? 'is-active' : ''}`}
            style={mode === m ? { background: 'var(--accent-glow)' } : undefined}
          >
            {m}
          </button>
        ))}
      </div>

      {onTitleChange ? (
        <div className="md-title-block">
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleBlur}
            placeholder="Note title"
            className="md-title-input"
          />
          {metadata ? (
            <div className="md-meta-row">
              {metadata.dateLabel ? (
                <button type="button" className="md-meta-chip">
                  {metadata.dateLabel}
                </button>
              ) : null}
              {metadata.classLabel ? (
                <button type="button" className="md-meta-chip">
                  {metadata.classLabel}
                </button>
              ) : null}
              {(metadata.tags || []).slice(0, 6).map((t) => (
                <span key={t} className="md-tag">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="md-split-wrap">
        {(mode === 'edit' || mode === 'split') && (
          <div className={mode === 'split' ? 'md-pane md-pane-left' : 'md-pane md-pane-full'}>
            <textarea
              ref={taRef}
              value={local}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              readOnly={readOnly}
              className="atlus-editor-textarea"
              spellCheck="false"
            />
          </div>
        )}
        {(mode === 'preview' || mode === 'split') && (
          <div className={`atlus-editor-preview ${mode === 'split' ? 'md-pane md-pane-right' : 'md-pane md-pane-full'}`}>
            <ReactMarkdown
              components={{
                h1: ({ node, ...p }) => <h1 className="md-h1" {...p} />,
                h2: ({ node, ...p }) => <h2 className="md-h2" {...p} />,
                h3: ({ node, ...p }) => <h3 className="md-h3" {...p} />,
                p: ({ node, ...p }) => <p className="md-p" {...p} />,
                ul: ({ node, ...p }) => <ul className="md-ul" {...p} />,
                ol: ({ node, ...p }) => <ol className="md-ol" {...p} />,
                blockquote: ({ node, ...p }) => (
                  <blockquote className="md-bq" {...p} />
                ),
                code: ({ node, inline, ...p }) =>
                  inline ? (
                    <code className="md-code-inline" {...p} />
                  ) : (
                    <code className="md-code-block" {...p} />
                  ),
                pre: ({ node, ...p }) => <pre className="md-pre-reset" {...p} />,
                table: ({ node, ...p }) => <table className="md-table" {...p} />,
                th: ({ node, ...p }) => <th className="md-th" {...p} />,
                td: ({ node, ...p }) => <td className="md-td" {...p} />,
              }}
            >
              {local || '_No content_'}
            </ReactMarkdown>
          </div>
        )}
      </div>

      <div className="md-footer-bar">
        <span className="mono">
          {words} words
          {totalNotesInClass != null ? ` · ${totalNotesInClass} notes in class` : ''}
          {sourceLabel ? ` · ${sourceLabel}` : ''}
        </span>
        <span
          className={`mono ${saveStatus === 'saved' ? 'save-ok' : saveStatus === 'saving' ? 'save-warn' : ''}`}
        >
          {saveLabel}
        </span>
      </div>
    </div>
  );
}

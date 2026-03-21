import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function ShareBrainModal({ brain, onClose }) {
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!brain?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api(`/api/brain/${brain.id}/share-link`, { method: 'POST', body: '{}' })
      .then((data) => {
        if (cancelled) return;
        const path = data.share_path || `/shared/${data.token}`;
        setShareUrl(`${window.location.origin}${path}`);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not create share link');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [brain?.id]);

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--veil)]" onClick={onClose}>
      <div
        className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[rgb(var(--text))]">Share brain</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] text-xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-[rgb(var(--muted))] mb-2">
          Anyone with the link can <strong className="text-[rgb(var(--text))]">join</strong> this brain as a collaborator
          after signing in: <strong className="text-[rgb(var(--text))]">{brain?.name}</strong>
        </p>
        {loading ? (
          <p className="text-sm text-[rgb(var(--muted))] py-4">Creating link…</p>
        ) : error ? (
          <p className="text-sm text-red-400 py-2">{error}</p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-sm text-[rgb(var(--text))]"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium transition-colors whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">
          Recipients open the link, sign in, and tap Join brain to add it to their workspace.
        </p>
      </div>
    </div>
  );
}

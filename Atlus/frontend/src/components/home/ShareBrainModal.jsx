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
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-card modal-card-sm" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
          <h2 className="modal-card-title" style={{ fontSize: '1.125rem' }}>
            Share brain
          </h2>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
            ×
          </button>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))', margin: '0 0 0.5rem' }}>
          Anyone with the link can <strong style={{ color: 'rgb(var(--text))' }}>join</strong> this brain as a collaborator
          after signing in: <strong style={{ color: 'rgb(var(--text))' }}>{brain?.name}</strong>
        </p>
        {loading ? (
          <p style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))', padding: '1rem 0' }}>Creating link…</p>
        ) : error ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--red)', padding: '0.5rem 0' }}>{error}</p>
        ) : (
          <div className="flex gap-2">
            <input type="text" readOnly value={shareUrl} className="field-input flex-1" style={{ fontSize: '0.875rem' }} />
            <button type="button" onClick={handleCopy} className="btn-sm-ocr" style={{ whiteSpace: 'nowrap' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
        <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'rgb(var(--muted))' }}>
          Recipients open the link, sign in, and tap Join brain to add it to their workspace.
        </p>
      </div>
    </div>
  );
}

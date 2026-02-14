import { useState, useMemo } from 'react';

const STORAGE_KEY = 'atlus_shared_brains';

export default function ShareBrainModal({ brain, onClose }) {
  const [copied, setCopied] = useState(false);
  const shareId = brain?.shareId || brain?.id || 'unknown';

  const url = useMemo(() => {
    if (typeof window === 'undefined' || !brain) return '';
    const brains = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    brains[shareId] = { id: brain.id, name: brain.name, badge: brain.badge };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(brains));
    return `${window.location.origin}/shared/${shareId}`;
  }, [brain, shareId]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
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
          Anyone with this link can add or download <strong className="text-[rgb(var(--text))]">{brain?.name}</strong>.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={url}
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
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">
          Backend integration coming soon — link works locally for now.
        </p>
      </div>
    </div>
  );
}

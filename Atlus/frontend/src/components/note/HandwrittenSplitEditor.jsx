import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? '';

/**
 * Original scan on the left, markdown editor on the right (authenticated image fetch).
 */
export default function HandwrittenSplitEditor({ brainId, sourceFileId, filename, children }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!brainId || !sourceFileId) {
      setUrl(null);
      return;
    }
    const token = localStorage.getItem('access_token');
    let revoked = false;
    let objectUrl = null;
    setErr(null);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/brain/${brainId}/sources/${sourceFileId}/file`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          throw new Error('Could not load scan');
        }
        const blob = await res.blob();
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e) {
        if (!revoked) setErr(e.message || 'Failed to load image');
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [brainId, sourceFileId]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 min-w-0 gap-0 border-t border-[color:var(--hairline)]">
      <aside className="lg:w-[min(44%,420px)] shrink-0 border-b lg:border-b-0 lg:border-r border-[color:var(--hairline)] bg-[var(--bg2)] flex flex-col min-h-[200px] lg:min-h-0 max-h-[40vh] lg:max-h-none">
        <p className="mono text-[10px] text-[var(--text3)] px-3 py-2 border-b border-[color:var(--hairline)] shrink-0">
          ORIGINAL SCAN
        </p>
        <div className="flex-1 min-h-0 flex items-center justify-center p-3 overflow-auto bg-[var(--fill-well)]">
          {err ? (
            <p className="text-sm text-amber-800 text-center px-2">{err}</p>
          ) : url ? (
            <img
              src={url}
              alt={filename || 'Handwritten note'}
              className="max-w-full max-h-full object-contain rounded-lg border border-[color:var(--hairline)] shadow-lg"
            />
          ) : (
            <p className="text-sm text-[var(--text3)]">Loading scan…</p>
          )}
        </div>
      </aside>
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}

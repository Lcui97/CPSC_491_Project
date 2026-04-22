import { useCallback, useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL ?? '';
const STORAGE_KEY = 'atlus_hw_scan_width_px';
const MIN_SCAN = 200;
const DEFAULT_SCAN = 380;

function readStoredScanWidth() {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(v) && v >= MIN_SCAN && v <= 1200) return v;
  } catch {
    // ignore
  }
  return DEFAULT_SCAN;
}

export default function HandwrittenSplitEditor({ classId, sourceFileId, filename, fileType = 'image', children }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);
  const [scanPx, setScanPx] = useState(readStoredScanWidth);
  const [isWide, setIsWide] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );
  const [dragging, setDragging] = useState(false);
  const rowRef = useRef(null);
  const scanPxRef = useRef(scanPx);
  scanPxRef.current = scanPx;

  useEffect(() => {
    function onResize() {
      setIsWide(window.innerWidth >= 1024);
    }
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isWide) return;
    const el = rowRef.current;
    if (!el) return;
    const max = Math.max(MIN_SCAN + 120, Math.floor(el.getBoundingClientRect().width * 0.78));
    setScanPx((w) => Math.min(Math.max(w, MIN_SCAN), max));
  }, [isWide]);

  useEffect(() => {
    if (!classId || !sourceFileId) {
      setUrl(null);
      return;
    }
    const token = localStorage.getItem('access_token');
    let revoked = false;
    let objectUrl = null;
    setErr(null);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/brain/${classId}/sources/${sourceFileId}/file`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          throw new Error('Could not load scan');
        }
        const buf = await res.arrayBuffer();
        if (revoked) return;
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        let blob;
        if (fileType === 'pdf' || ct.includes('pdf')) {
          blob = new Blob([buf], { type: 'application/pdf' });
        } else {
          blob = new Blob([buf], { type: ct && !ct.includes('octet-stream') ? ct : 'image/jpeg' });
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch (e) {
        if (!revoked) setErr(e.message || 'Failed to load file');
      }
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [classId, sourceFileId, fileType]);

  const onResizeMouseDown = useCallback(
    (e) => {
      if (!isWide) return;
      e.preventDefault();
      const row = rowRef.current;
      if (!row) return;
      const startX = e.clientX;
      const startW = scanPxRef.current;
      const maxW = Math.max(MIN_SCAN + 120, Math.floor(row.getBoundingClientRect().width * 0.78));
      setDragging(true);
      function move(ev) {
        const dx = ev.clientX - startX;
        const nw = Math.max(MIN_SCAN, Math.min(startW + dx, maxW));
        scanPxRef.current = nw;
        setScanPx(nw);
      }
      function up() {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        setDragging(false);
        try {
          localStorage.setItem(STORAGE_KEY, String(scanPxRef.current));
        } catch {
          // ignore
        }
      }
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [isWide]
  );

  const scanStyle =
    isWide ? { width: scanPx, flexShrink: 0, flexGrow: 0, maxHeight: 'none' } : undefined;

  return (
    <div
      className="flex-1 flex flex-col min-h-0 min-w-0"
      style={{ borderTop: '1px solid var(--hairline)' }}
    >
      <div ref={rowRef} className="flex-1 flex hw-split-row min-h-0" style={{ minHeight: 0 }}>
        <aside className="hw-scan-pane" style={scanStyle}>
          <p
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--text3)',
              padding: '0.5rem 0.75rem',
              borderBottom: '1px solid var(--hairline)',
              margin: 0,
            }}
          >
            {fileType === 'pdf' ? 'ORIGINAL PDF' : 'ORIGINAL SCAN'}
          </p>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              padding: '0.75rem',
              overflow: 'auto',
              background: 'var(--fill-well)',
            }}
          >
            {err ? (
              <p style={{ fontSize: '0.875rem', color: '#92400e', textAlign: 'center', padding: '0 0.5rem' }}>{err}</p>
            ) : url ? (
              fileType === 'pdf' ? (
                <iframe
                  title={filename || 'PDF'}
                  src={url}
                  style={{
                    width: '100%',
                    flex: '1 1 auto',
                    minHeight: 'min(88vh, 1200px)',
                    alignSelf: 'stretch',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--hairline)',
                    background: '#fff',
                  }}
                />
              ) : (
                <img
                  src={url}
                  alt={filename || 'Handwritten note'}
                  style={{
                    alignSelf: 'center',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--hairline)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
              )
            ) : (
              <p className="text-muted">Loading…</p>
            )}
          </div>
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize scan and editor"
          title="Drag to resize"
          className={`hw-split-resize ${dragging ? 'is-dragging' : ''}`}
          onMouseDown={onResizeMouseDown}
        />
        <div className="hw-editor-pane">{children}</div>
      </div>
    </div>
  );
}

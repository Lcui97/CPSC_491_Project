import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrains, useMeSummary } from '../../api/brainQueries';
import AtlusLogo from '../AtlusLogo';

export default function TopBar({ compact = false, breadcrumb = null, activeBrainName = null }) {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const accountRef = useRef(null);
  const brainRef = useRef(null);

  const { data: summary, isLoading: summaryLoading } = useMeSummary();
  const { data: brains = [] } = useBrains();
  const initials = useMemo(() => {
    const email = summary?.email || 'A';
    return email[0]?.toUpperCase() || 'A';
  }, [summary?.email]);
  const currentBrainName = activeBrainName || brains?.[0]?.name || 'Select brain';

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        accountRef.current && !accountRef.current.contains(e.target) &&
        brainRef.current && !brainRef.current.contains(e.target)
      ) {
        setAccountOpen(false);
        setBrainOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login', { replace: true });
  }

  function handleBrainSwitch(path) {
    navigate(path);
    setBrainOpen(false);
  }

  return (
    <header className={`atlus-topbar ${compact ? 'compact' : ''}`}>
      <div className="h-full px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => navigate('/home')} className="flex items-center gap-2 min-w-0">
            <AtlusLogo size={28} className="rounded-[10px] border border-[color:var(--hairline)] bg-black" />
            <span className="font-semibold text-[var(--text1)]">Atlus</span>
          </button>
          <span className="h-6 w-px bg-[color:var(--hairline)] shrink-0" />
          <div className="relative" ref={brainRef}>
            <button
              type="button"
              onClick={() => {
                setBrainOpen((v) => !v);
                setAccountOpen(false);
              }}
              className="h-8 px-3 rounded-lg border bg-[var(--bg3)] flex items-center gap-2 max-w-[240px]"
              style={{ borderColor: 'var(--border2)' }}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--teal)' }} />
              <span className="text-sm text-[var(--text1)] truncate">{currentBrainName}</span>
            </button>
            {brainOpen && (
              <div className="absolute left-0 top-full mt-1 py-1 min-w-[220px] rounded-xl border bg-[var(--bg2)] z-50" style={{ borderColor: 'var(--border2)' }}>
                {brains.map((brain) => (
                  <button
                    key={brain.id}
                    type="button"
                    onClick={() => handleBrainSwitch(`/brain/${brain.id}/notes`)}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--text1)] hover:bg-[var(--bg4)]"
                  >
                    {brain.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {breadcrumb ? (
            <p className="text-xs text-[var(--text2)] truncate hidden md:block">
              {breadcrumb}
            </p>
          ) : null}
        </div>

        <div className="flex-1 flex items-center justify-center px-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('atlus-open-quick-switcher'))}
            className="w-full max-w-[380px] h-9 rounded-lg border flex items-center gap-2 px-3 bg-[var(--bg3)] text-left"
            style={{ borderColor: 'var(--border2)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text3)] shrink-0">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="flex-1 text-sm text-[var(--text3)]">Search notes, sources, concepts…</span>
            <span className="mono text-[10px] px-1.5 py-0.5 rounded border text-[var(--text2)] border-[color:var(--hairline)] shrink-0">⌘K</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="w-9 h-9 rounded-[10px] border border-[color:var(--hairline)] bg-[var(--bg3)] text-[var(--text2)]">🔔</button>
          <button type="button" className="w-9 h-9 rounded-[10px] border border-[color:var(--hairline)] bg-[var(--bg3)] text-[var(--text2)]">⚙</button>
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => {
                setAccountOpen((v) => !v);
                setBrainOpen(false);
              }}
              className="w-9 h-9 flex items-center justify-center rounded-[10px] text-white font-medium"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--teal))' }}
            >
              {initials}
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-full mt-1 py-3 px-4 min-w-[220px] rounded-xl border bg-[var(--bg2)] z-50" style={{ borderColor: 'var(--border2)' }}>
                <p className="mono text-[10px] text-[var(--text2)] mb-2">ACCOUNT</p>
                {summaryLoading ? (
                  <p className="text-sm text-[var(--text2)]">Loading...</p>
                ) : (
                  <>
                    <p className="text-sm text-[var(--text1)] mb-2 break-all">{summary?.email ?? '--'}</p>
                    <p className="text-xs text-[var(--text2)] mb-1">Notes: {summary?.total_notes ?? 0}</p>
                    <p className="text-xs text-[var(--text2)]">Brains: {summary?.brains_count ?? 0}</p>
                  </>
                )}
                <button type="button" onClick={logout} className="mt-3 w-full h-8 rounded-lg border border-[color:var(--hairline)] text-sm text-[var(--text1)] hover:bg-[var(--bg4)]">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

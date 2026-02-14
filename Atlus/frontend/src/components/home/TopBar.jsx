import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function TopBar() {
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const accountRef = useRef(null);
  const quickRef = useRef(null);

  useEffect(() => {
    api('/home')
      .then((data) => setWelcomeMessage(data.message || ''))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        accountRef.current && !accountRef.current.contains(e.target) &&
        quickRef.current && !quickRef.current.contains(e.target)
      ) {
        setAccountOpen(false);
        setQuickOpen(false);
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

  function handleQuickAction(path) {
    navigate(path);
    setQuickOpen(false);
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-[rgb(var(--panel))] border-b border-[rgb(var(--border))]">
      <div>
        <span className="font-semibold text-[rgb(var(--text))]">Atlus</span>
        <span className="ml-2 text-sm text-[rgb(var(--muted))]">Knowledge hub</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Quick Actions dropdown */}
        <div className="relative" ref={quickRef}>
          <button
            type="button"
            onClick={() => { setQuickOpen((v) => !v); setAccountOpen(false); }}
            className="py-1.5 px-3 rounded-lg text-sm bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--accent))] hover:border-[rgb(var(--accent))] hover:text-white transition-colors"
          >
            Quick Actions
          </button>
          {quickOpen && (
            <div className="absolute right-0 top-full mt-1 py-1 min-w-[180px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg shadow-lg z-50">
              <button
                type="button"
                onClick={() => handleQuickAction('/ingest')}
                className="w-full py-2 px-3 text-left text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))]"
              >
                Document Ingestion
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('/knowledge-gap')}
                className="w-full py-2 px-3 text-left text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))]"
              >
                Knowledge Gap Analysis
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('/brain')}
                className="w-full py-2 px-3 text-left text-sm text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))]"
              >
                Open Brain Map
              </button>
            </div>
          )}
        </div>

        {/* Account icon + dropdown */}
        <div className="relative" ref={accountRef}>
          <button
            type="button"
            onClick={() => { setAccountOpen((v) => !v); setQuickOpen(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--accent))] hover:border-[rgb(var(--accent))] hover:text-white transition-colors"
            title="Account"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
          {accountOpen && (
            <div className="absolute right-0 top-full mt-1 py-3 px-4 min-w-[200px] bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-lg shadow-lg z-50">
              <p className="text-xs font-medium text-[rgb(var(--muted))] mb-1">Account</p>
              {loading ? (
                <p className="text-sm text-[rgb(var(--muted))]">Loading…</p>
              ) : (
                <p className="text-sm text-[rgb(var(--text))] mb-2">{welcomeMessage || '—'}</p>
              )}
              <p className="text-xs text-[rgb(var(--muted))]">Plan: Local MVP</p>
              <p className="text-xs text-[rgb(var(--muted))]">Status: Connected</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={logout}
          className="py-1.5 px-3 rounded-lg text-sm bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--accent))] hover:border-[rgb(var(--accent))] hover:text-white transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

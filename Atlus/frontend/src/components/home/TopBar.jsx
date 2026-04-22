import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMeSummary } from '../../api/brainQueries';
import AtlusLogo from '../AtlusLogo';
import { useAssistantPanel } from '../../context/AssistantPanelContext';
import { IconAssistantPerson } from '../assistant/ClassAssistantChat';

function IconSignOut(props) {
  const { className = '' } = props;
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function TopBar({ compact = false, breadcrumb = null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

  const { data: summary, isLoading: summaryLoading } = useMeSummary();
  const { togglePanel, isOpen } = useAssistantPanel();
  const initials = useMemo(() => {
    const fromName = (summary?.display_name || '').trim().charAt(0);
    if (fromName) return fromName.toUpperCase();
    const email = summary?.email || '';
    return (email[0]?.toUpperCase() || '?');
  }, [summary?.display_name, summary?.email]);

  const displayLabel = (summary?.display_name || '').trim() || summary?.email?.split('@')[0] || 'Account';

  useEffect(() => {
    function handleClickOutside(e) {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') setAccountOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [accountOpen]);

  const signOut = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    queryClient.clear();
    setAccountOpen(false);
    navigate('/login', { replace: true });
  }, [navigate, queryClient]);

  return (
    <header className={`atlus-topbar ${compact ? 'compact' : ''}`}>
      <div className="topbar-inner">
        <div className="topbar-left">
          <button type="button" onClick={() => navigate('/home')} className="topbar-brand-btn">
            <AtlusLogo size={28} className="atlus-logo-img logo-frame" />
            <span className="topbar-brand-text">Atlus</span>
          </button>
          {breadcrumb ? (
            <p className="topbar-breadcrumb">
              {breadcrumb}
            </p>
          ) : null}
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="topbar-icon-btn topbar-assistant-btn"
            onClick={togglePanel}
            title={isOpen ? 'Hide assistant panel' : 'Open assistant'}
            aria-pressed={isOpen}
          >
            <IconAssistantPerson />
          </button>
          <div className="rel" ref={accountRef}>
            <button
              type="button"
              onClick={() => {
                setAccountOpen((v) => !v);
              }}
              className="topbar-avatar"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label="Account menu"
              title="Account"
            >
              {initials}
            </button>
            {accountOpen && (
              <div className="topbar-account-panel" role="menu" aria-label="Account">
                <div className="topbar-account-head">
                  <span className="topbar-account-avatar" aria-hidden>{initials}</span>
                  <div className="topbar-account-id">
                    {summaryLoading ? (
                      <span className="topbar-account-loading">Loading…</span>
                    ) : (
                      <>
                        <span className="topbar-account-name">{displayLabel}</span>
                        <span className="topbar-account-email">{summary?.email ?? '—'}</span>
                      </>
                    )}
                  </div>
                </div>
                {!summaryLoading && summary ? (
                  <dl className="topbar-account-stats">
                    <div>
                      <dt>Notes</dt>
                      <dd>{summary.total_notes ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Classes</dt>
                      <dd>{summary.brains_count ?? 0}</dd>
                    </div>
                  </dl>
                ) : null}
                <button type="button" role="menuitem" className="topbar-sign-out" onClick={signOut}>
                  <IconSignOut />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

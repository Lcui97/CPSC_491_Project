import { useNavigate, useLocation } from 'react-router-dom';
import BrainFilters from './BrainFilters';

export default function WorkspaceSidebar({
  sidebarExpanded,
  setSidebarExpanded,
  activeBrain,
  setActiveBrain,
  brains,
  me,
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isActive = (id) => {
    if (id === 'home') return pathname === '/home';
    if (id === 'notes') return pathname.startsWith('/home/notes');
    if (id === 'calendar') return pathname.startsWith('/calendar') || pathname.includes('/calendar');
    if (id === 'sources') return pathname.includes('/sources');
    if (id === 'ingest') return pathname === '/ingest';
    return false;
  };

  const brainForNav = activeBrain || brains[0] || null;

  const navItems = [
    { id: 'home', label: 'Home', path: '/home' },
    { id: 'notes', label: 'Notes', path: '/home/notes', badge: me?.total_notes ?? 0 },
    { id: 'calendar', label: 'Calendar', path: '/calendar' },
    {
      id: 'sources',
      label: 'Sources',
      path: brainForNav ? `/brain/${brainForNav.id}/sources` : null,
      disabled: !brainForNav,
    },
    { id: 'ingest', label: 'Ingest', path: '/ingest', badge: 'New' },
  ];

  return (
    <aside
      className="workspace-aside"
      style={{ width: sidebarExpanded ? 220 : 56 }}
    >
      <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--hairline)' }}>
        <button
          type="button"
          onClick={() => setSidebarExpanded((v) => !v)}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%' }}
        >
          {sidebarExpanded ? 'Collapse' : '→'}
        </button>
      </div>
      <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--hairline)' }}>
        {sidebarExpanded ? <p className="mono" style={{ fontSize: 10, color: 'var(--text3)', padding: '0 0.5rem', margin: '0 0 0.25rem' }}>WORKSPACE</p> : null}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map((item) => {
            const active = isActive(item.id);
            const go = () => {
              if (item.disabled || item.path == null) return;
              navigate(item.path);
            };
            return (
              <button
                key={item.id}
                type="button"
                onClick={go}
                disabled={item.disabled}
                title={item.disabled ? 'Select a brain below first' : undefined}
                className={`workspace-nav-btn ${active ? 'is-active' : ''}`}
              >
                {sidebarExpanded ? <span>{item.label}</span> : <span style={{ fontSize: '0.75rem' }}>•</span>}
                {sidebarExpanded && item.badge != null && !item.disabled ? (
                  <span
                    className="mono"
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: item.badge === 'New' ? 'var(--accent-glow)' : 'var(--fill-muted)',
                      color: item.badge === 'New' ? 'rgb(var(--accent))' : 'var(--text2)',
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto" style={{ padding: '0.5rem', minHeight: 0 }}>
        {sidebarExpanded ? (
          <div style={{ padding: '0.25rem' }}>
            <BrainFilters
              activeBrainId={activeBrain?.id}
              onEnterBrain={(brain) => {
                setActiveBrain(brain);
                navigate(`/brain/${brain.id}/notes`);
              }}
              onBrainRemoved={(id) => {
                if (activeBrain?.id === id) setActiveBrain(null);
                if (pathname.includes(`/brain/${id}`)) navigate('/home');
              }}
            />
          </div>
        ) : (
          <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text3)' }}>Brains</div>
        )}
      </div>
    </aside>
  );
}

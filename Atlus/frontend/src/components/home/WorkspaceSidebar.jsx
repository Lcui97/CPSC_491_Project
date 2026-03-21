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
    if (id === 'sources') return pathname.includes('/sources');
    if (id === 'ingest') return pathname === '/ingest';
    return false;
  };

  const brainForNav = activeBrain || brains[0] || null;

  const navItems = [
    { id: 'home', label: 'Home', path: '/home' },
    { id: 'notes', label: 'Notes', path: '/home/notes', badge: me?.total_notes ?? 0 },
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
      className={`shrink-0 border-r border-[color:var(--hairline)] overflow-hidden flex flex-col transition-[width] duration-200 ${
        sidebarExpanded ? 'w-[220px]' : 'w-[56px]'
      }`}
      style={{ background: 'var(--bg2)' }}
    >
      <div className="p-2 border-b border-[color:var(--hairline)]">
        <button
          type="button"
          onClick={() => setSidebarExpanded((v) => !v)}
          className="w-full h-8 rounded-lg border border-dashed border-[color:var(--hairline-hover)] text-[var(--text2)] text-sm hover:text-[var(--text1)]"
        >
          {sidebarExpanded ? 'Collapse' : '→'}
        </button>
      </div>
      <div className="p-2 border-b border-[color:var(--hairline)]">
        {sidebarExpanded && <p className="mono text-[10px] text-[var(--text3)] px-2 mb-1">WORKSPACE</p>}
        <nav className="space-y-1">
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
                className={`w-full h-9 rounded-lg px-2 text-left flex items-center justify-between ${
                  active
                    ? 'text-[var(--accent)] bg-[var(--accent-glow)] border border-[color:var(--accent-27)]'
                    : item.disabled
                      ? 'text-[var(--text3)] opacity-50 cursor-not-allowed'
                      : 'text-[var(--text2)] hover:bg-[var(--bg3)]'
                }`}
              >
                {sidebarExpanded ? <span className="text-sm">{item.label}</span> : <span className="text-xs">•</span>}
                {sidebarExpanded && item.badge != null && !item.disabled ? (
                  <span
                    className={`mono text-[10px] px-1.5 py-0.5 rounded ${
                      item.badge === 'New' ? 'text-[var(--accent)] bg-[var(--accent-glow)]' : 'text-[var(--text2)] bg-[var(--fill-muted)]'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex-1 min-w-0 overflow-y-auto p-2">
        {sidebarExpanded ? (
          <div className="p-1">
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
          <div className="p-2 text-center text-xs text-[var(--text3)]">Brains</div>
        )}
      </div>
    </aside>
  );
}

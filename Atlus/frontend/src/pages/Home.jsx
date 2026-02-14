import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import TopBar from '../components/home/TopBar';
import BrainFilters from '../components/home/BrainFilters';
import GraphView from '../components/home/GraphView';
import BrainNotesView from '../components/home/BrainNotesView';

export default function Home() {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeBrain, setActiveBrain] = useState(null);

  useEffect(() => {
    api('/home').catch(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      navigate('/login', { replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex flex-col">
      <TopBar />
      <main className="flex-1 flex overflow-hidden">
        <aside
          className={`shrink-0 border-r border-[rgb(var(--border))] overflow-hidden flex transition-[width] duration-200 ${
            sidebarExpanded ? 'w-56' : 'w-12'
          }`}
        >
          <div className="flex-1 min-w-0 overflow-y-auto">
            {sidebarExpanded ? (
              <div className="p-4">
                <BrainFilters
                  activeBrainId={activeBrain?.id}
                  onEnterBrain={setActiveBrain}
                  onCollapseSidebar={() => setSidebarExpanded(false)}
                />
              </div>
            ) : (
              <div className="p-2 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarExpanded(true)}
                  className="p-2 rounded-lg text-[rgb(var(--muted))] hover:bg-[rgb(var(--panel2))] hover:text-[rgb(var(--text))] transition-colors"
                  title="Expand sidebar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </aside>
        <div className="flex-1 p-4 overflow-auto">
          {activeBrain ? (
            <BrainNotesView brain={activeBrain} onBack={() => setActiveBrain(null)} />
          ) : (
            <GraphView />
          )}
        </div>
      </main>
    </div>
  );
}

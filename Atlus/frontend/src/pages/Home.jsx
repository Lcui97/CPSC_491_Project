import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/home/TopBar';
import BrainFilters from '../components/home/BrainFilters';
import GraphView from '../components/home/GraphView';
import BrainNotesView from '../components/home/BrainNotesView';
import SearchPrompter from '../components/home/SearchPrompter';

export default function Home() {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeBrain, setActiveBrain] = useState(null);

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
                  onEnterBrain={(brain) => {
                    setActiveBrain(brain);
                    navigate(`/brain/${brain.id}/notes`);
                  }}
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
        <div className="flex-1 flex flex-col p-4 overflow-auto">
          <div className="shrink-0 mb-4 max-w-2xl">
            <SearchPrompter
              onSelectNode={(node) => {
                if (node?.brain_id) navigate(`/brain/${node.brain_id}/notes/${node.id}`);
              }}
            />
          </div>
          <div className="flex-1 min-h-0">
            {activeBrain ? (
              <BrainNotesView brain={activeBrain} onBack={() => setActiveBrain(null)} />
            ) : (
              <GraphView />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

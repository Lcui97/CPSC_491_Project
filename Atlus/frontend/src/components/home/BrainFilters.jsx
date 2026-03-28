import { useState, useEffect, useCallback } from 'react';
import ShareBrainModal from './ShareBrainModal';
import BrainCreateModal from './BrainCreateModal';
import { api } from '../../api/client';
import { useDeleteBrain, useLeaveBrain } from '../../api/brainQueries';

const BRAINS_STORAGE_KEY = 'atlus_brains';

// Stale demo data if nothing’s in localStorage yet
const INITIAL_BRAINS = [
  { id: '1', name: 'Notes Brain', badge: 'Notes' },
  { id: '2', name: 'Textbook Brain', badge: 'Textbook' },
  { id: '3', name: 'Combined View', badge: 'Compare' },
];

function loadBrainsFromStorage() {
  try {
    const saved = localStorage.getItem(BRAINS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_BRAINS;
  } catch {
    return INITIAL_BRAINS;
  }
}

function saveBrainsToStorage(brains) {
  localStorage.setItem(BRAINS_STORAGE_KEY, JSON.stringify(brains));
}

export default function BrainFilters({ activeBrainId, onEnterBrain, onCollapseSidebar, onBrainRemoved }) {
  const [brains, setBrains] = useState(loadBrainsFromStorage());

  const [selected, setSelected] = useState(() => {
    const b = loadBrainsFromStorage();
    return new Set(b.map((x) => x.id));
  });

  const [shareBrain, setShareBrain] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const deleteBrain = useDeleteBrain();
  const leaveBrain = useLeaveBrain();
  const removePending = deleteBrain.isPending || leaveBrain.isPending;

  useEffect(() => {
    api('/api/brain/list')
      .then((res) => {
        const list = Array.isArray(res.brains) ? res.brains : [];
        setBrains(list);
        setSelected(new Set(list.map((x) => x.id)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    saveBrainsToStorage(brains);
  }, [brains]);

  const handleBrainCreated = useCallback((brain) => {
    setBrains((prev) => (prev.some((b) => b.id === brain.id) ? prev : [...prev, brain]));
    setSelected((prev) => new Set([...prev, brain.id]));
  }, []);

  function toggleFilter(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRemoveBrain(brain) {
    const isOwner = brain.is_owner !== false;
    const syncLocal = (id) => {
      setBrains((prev) => prev.filter((b) => b.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onBrainRemoved?.(id);
    };
    if (isOwner) {
      if (
        !window.confirm(
          `Delete “${brain.name}” and all its notes, sources, and uploaded files? This cannot be undone.`
        )
      ) {
        return;
      }
      deleteBrain.mutate(brain.id, {
        onSuccess: () => syncLocal(brain.id),
        onError: (err) => window.alert(err.message || 'Could not delete brain'),
      });
    } else {
      if (!window.confirm(`Leave “${brain.name}”? You can rejoin only if someone shares it again.`)) return;
      leaveBrain.mutate(brain.id, {
        onSuccess: () => syncLocal(brain.id),
        onError: (err) => window.alert(err.message || 'Could not leave brain'),
      });
    }
  }

  function addBrain() {
    setShowCreateModal(true);
  }

  function handleShare(e, brain) {
    e.stopPropagation();
    setShareBrain(brain);
  }

  return (
    <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[rgb(var(--text))]">My Brains</h2>

        <div className="flex items-center gap-1">
          {onCollapseSidebar && (
            <button
              type="button"
              onClick={onCollapseSidebar}
              className="p-1.5 rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--panel2))] hover:text-[rgb(var(--text))] transition-colors"
              title="Collapse sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={addBrain}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-lg leading-none transition-colors"
            title="Add brain"
          >
            +
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {brains.map((brain) => (
          <li
            key={brain.id}
            className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
              activeBrainId === brain.id
                ? 'bg-[rgb(var(--accent))]/30 border-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))]'
                : selected.has(brain.id)
                  ? 'bg-[rgb(var(--accent))]/20 border-[rgb(var(--accent))]'
                  : 'bg-[rgb(var(--panel2))] border-[rgb(var(--border))]'
            }`}
          >
            <button
              type="button"
              onClick={() => (onEnterBrain ? onEnterBrain(brain) : toggleFilter(brain.id))}
              className="flex-1 min-w-0 text-left"
            >
              <p className="text-sm text-[rgb(var(--text))] truncate">{brain.name}</p>
              <span className="text-xs text-[rgb(var(--muted))]">{brain.badge}</span>
            </button>

            {brain.is_owner !== false ? (
              <button
                type="button"
                onClick={(e) => handleShare(e, brain)}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-[rgb(var(--muted))] hover:text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/10 transition-colors"
                title="Share brain"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              </button>
            ) : (
              <span className="shrink-0 w-6 h-6" aria-hidden />
            )}

            <button
              type="button"
              disabled={removePending}
              onClick={() => handleRemoveBrain(brain)}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-[rgb(var(--muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              title={brain.is_owner === false ? 'Leave shared brain' : 'Delete brain'}
            >
              −
            </button>
          </li>
        ))}
      </ul>

      {shareBrain && (
        <ShareBrainModal brain={shareBrain} onClose={() => setShareBrain(null)} />
      )}
      {showCreateModal && (
        <BrainCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleBrainCreated}
        />
      )}
    </div>
  );
}

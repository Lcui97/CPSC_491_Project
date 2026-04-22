import { useState, useEffect, useCallback } from 'react';
import ShareBrainModal from './ShareBrainModal';
import BrainCreateModal from './BrainCreateModal';
import { api } from '../../api/client';
import { useDeleteBrain, useLeaveBrain } from '../../api/brainQueries';

const BRAINS_STORAGE_KEY = 'atlus_brains';

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
    <div className="brain-filters-panel">
      <div className="brain-filters-head">
        <h2 className="brain-filters-title">My Brains</h2>

        <div className="brain-filters-tools">
          {onCollapseSidebar && (
            <button
              type="button"
              onClick={onCollapseSidebar}
              className="brain-filters-icon-btn"
              title="Collapse sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <button type="button" onClick={addBrain} className="brain-filters-add" title="Add brain">
            +
          </button>
        </div>
      </div>

      <ul className="brain-filters-list">
        {brains.map((brain) => {
          const rowActive = activeBrainId === brain.id;
          const rowSelected = selected.has(brain.id);
          let rowClass = 'brain-filter-row';
          if (rowActive) rowClass += ' is-active';
          else if (rowSelected) rowClass += ' is-selected';

          return (
            <li key={brain.id} className={rowClass}>
              <button
                type="button"
                onClick={() => (onEnterBrain ? onEnterBrain(brain) : toggleFilter(brain.id))}
                className="brain-filter-main"
              >
                <p className="brain-filter-name">{brain.name}</p>
                <span className="brain-filter-badge">{brain.badge}</span>
              </button>

              {brain.is_owner !== false ? (
                <button
                  type="button"
                  onClick={(e) => handleShare(e, brain)}
                  className="brain-filter-icon-btn"
                  title="Share brain"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </button>
              ) : (
                <span className="brain-filter-icon-btn" style={{ visibility: 'hidden' }} aria-hidden />
              )}

              <button
                type="button"
                disabled={removePending}
                onClick={() => handleRemoveBrain(brain)}
                className="brain-filter-icon-btn danger"
                title={brain.is_owner === false ? 'Leave shared brain' : 'Delete brain'}
              >
                −
              </button>
            </li>
          );
        })}
      </ul>

      {shareBrain && <ShareBrainModal brain={shareBrain} onClose={() => setShareBrain(null)} />}
      {showCreateModal && (
        <BrainCreateModal onClose={() => setShowCreateModal(false)} onCreated={handleBrainCreated} />
      )}
    </div>
  );
}

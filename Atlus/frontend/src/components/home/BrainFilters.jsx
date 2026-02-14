import { useState, useEffect } from 'react';
import ShareBrainModal from './ShareBrainModal';

// Key used to store/retrieve brains from localStorage (persists across refreshes)
const BRAINS_STORAGE_KEY = 'atlus_brains';

// Fallback brains used the very first time (or if localStorage is empty/broken)
const INITIAL_BRAINS = [
  { id: '1', name: 'Notes Brain', badge: 'Notes' },
  { id: '2', name: 'Textbook Brain', badge: 'Textbook' },
  { id: '3', name: 'Combined View', badge: 'Compare' },
];

function loadBrains() {
  try {
    // Read saved brains from localStorage (string), then parse into JS objects
    const saved = localStorage.getItem(BRAINS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_BRAINS;
  } catch {
    // If JSON.parse fails or localStorage is blocked, just use defaults
    return INITIAL_BRAINS;
  }
}

function saveBrains(brains) {
  // Convert brains array into a JSON string and store it
  localStorage.setItem(BRAINS_STORAGE_KEY, JSON.stringify(brains));
}

export default function BrainFilters({ activeBrainId, onEnterBrain, onCollapseSidebar }) {
  // List of brain objects displayed in the UI
  // NOTE: loadBrains() runs immediately here, so this uses whatever is in localStorage
  const [brains, setBrains] = useState(loadBrains());

  // Set of selected brain IDs (used for “filtering” highlight state)
  // Using a function initializer so it runs only once on mount
  const [selected, setSelected] = useState(() => {
    const b = loadBrains();
    return new Set(b.map((x) => x.id));
  });

  // Holds the brain object we’re currently sharing (or null if not sharing)
  const [shareBrain, setShareBrain] = useState(null);

  // Whenever "brains" changes, save the updated list to localStorage
  useEffect(() => {
    saveBrains(brains);
  }, [brains]);

  function toggleFilter(id) {
    // Update selected set immutably:
    // copy the previous Set, then add/remove the id
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeBrain(id) {
    // Remove the brain from the brains array
    setBrains((prev) => prev.filter((b) => b.id !== id));

    // Also remove its id from the selected Set (so we don't keep a "ghost" selection)
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function addBrain() {
    // Quick unique-ish ID using current time in ms
    // (Usually fine for small apps, but not perfect if called extremely fast)
    const id = String(Date.now());

    // Create a new brain object
    const newBrain = {
      id,
      name: `New Brain ${brains.length + 1}`, // uses current "brains" length to name it
      badge: 'Notes',
    };

    // Add it to the end of the brains list
    setBrains((prev) => [...prev, newBrain]);

    // Auto-select it by adding its id to the Set
    setSelected((prev) => new Set([...prev, id]));
  }

  function handleShare(e, brain) {
    // Prevent the click from also triggering parent click handlers (good UX)
    e.stopPropagation();
    // Open the modal by setting which brain is being shared
    setShareBrain(brain);
  }

  return (
    <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4 h-fit">
      {/* Header row: title + buttons */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-[rgb(var(--text))]">My Brains</h2>

        <div className="flex items-center gap-1">
          {/* Optional collapse button: only rendered if prop is provided */}
          {onCollapseSidebar && (
            <button
              type="button"
              onClick={onCollapseSidebar}
              className="p-1.5 rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--panel2))] hover:text-[rgb(var(--text))] transition-colors"
              title="Collapse sidebar"
            >
              {/* Left chevron icon */}
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

          {/* Add brain button */}
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

      {/* Brain list */}
      <ul className="space-y-2">
        {brains.map((brain) => (
          <li
            key={brain.id}
            // Conditional styling:
            // 1) activeBrainId => "currently opened" style
            // 2) selected => "selected filter" style
            // 3) else => default style
            className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
              activeBrainId === brain.id
                ? 'bg-[rgb(var(--accent))]/30 border-[rgb(var(--accent))] ring-1 ring-[rgb(var(--accent))]'
                : selected.has(brain.id)
                  ? 'bg-[rgb(var(--accent))]/20 border-[rgb(var(--accent))]'
                  : 'bg-[rgb(var(--panel2))] border-[rgb(var(--border))]'
            }`}
          >
            {/* Main clickable area:
                - If onEnterBrain is provided, clicking opens the brain
                - Otherwise, clicking toggles filter selection */}
            <button
              type="button"
              onClick={() => (onEnterBrain ? onEnterBrain(brain) : toggleFilter(brain.id))}
              className="flex-1 min-w-0 text-left"
            >
              {/* Brain name (truncated so it doesn't overflow) */}
              <p className="text-sm text-[rgb(var(--text))] truncate">{brain.name}</p>
              {/* Small badge/label underneath */}
              <span className="text-xs text-[rgb(var(--muted))]">{brain.badge}</span>
            </button>

            {/* Share button opens modal */}
            <button
              type="button"
              onClick={(e) => handleShare(e, brain)}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-[rgb(var(--muted))] hover:text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))]/10 transition-colors"
              title="Share brain"
            >
              {/* Share icon */}
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

            {/* Remove brain button */}
            <button
              type="button"
              onClick={() => removeBrain(brain.id)}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-[rgb(var(--muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Remove brain"
            >
              −
            </button>
          </li>
        ))}
      </ul>

      {/* Only render the modal when shareBrain is not null */}
      {shareBrain && (
        <ShareBrainModal brain={shareBrain} onClose={() => setShareBrain(null)} />
      )}
    </div>
  );
}

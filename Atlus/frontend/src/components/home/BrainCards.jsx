const MOCK_BRAINS = [
  { name: 'Notes Brain', badge: 'Notes' },
  { name: 'Textbook Brain', badge: 'Textbook' },
  { name: 'Combined View', badge: 'Compare' },
];

export default function BrainCards() {
  function handleOpen() {
    alert('Open — placeholder.');
  }

  return (
    <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
      <h2 className="text-sm font-medium text-[rgb(var(--text))] mb-3">My Brains</h2>
      <div className="space-y-2">
        {MOCK_BRAINS.map((brain, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))]"
          >
            <div className="min-w-0">
              <p className="text-sm text-[rgb(var(--text))] truncate">{brain.name}</p>
              <span className="text-xs text-[rgb(var(--muted))]">{brain.badge}</span>
            </div>
            <button
              type="button"
              onClick={handleOpen}
              className="shrink-0 py-1 px-2 rounded text-xs bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white transition-colors"
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

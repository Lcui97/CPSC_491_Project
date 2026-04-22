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
    <div className="panel-rgb">
      <h2 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgb(var(--text))', margin: '0 0 0.75rem' }}>My Brains</h2>
      <div>
        {MOCK_BRAINS.map((brain, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2"
            style={{
              padding: '0.5rem',
              marginBottom: '0.5rem',
              borderRadius: '0.5rem',
              background: 'rgb(var(--panel2))',
              border: '1px solid rgb(var(--border))',
            }}
          >
            <div className="min-w-0">
              <p style={{ fontSize: '0.875rem', color: 'rgb(var(--text))', margin: 0 }} className="truncate">{brain.name}</p>
              <span style={{ fontSize: '0.75rem', color: 'rgb(var(--muted))' }}>{brain.badge}</span>
            </div>
            <button type="button" onClick={handleOpen} className="btn btn-primary btn-xs shrink-0">
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

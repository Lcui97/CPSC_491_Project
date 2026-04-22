const MOCK_ITEMS = [
  { label: 'Uploaded: Notes - Week 1', time: '2h ago' },
  { label: 'Generated: Notes Brain', time: '1d ago' },
  { label: 'Compared: Notes vs Textbook', time: '2d ago' },
];

export default function RecentActivity() {
  return (
    <div className="panel-rgb">
      <h2 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgb(var(--text))', margin: '0 0 0.75rem' }}>Recent Activity</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {MOCK_ITEMS.map((item, i) => (
          <li key={i} className="flex items-center gap-2" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(var(--accent))', flexShrink: 0 }} />
            <span style={{ color: 'rgb(var(--text))', flex: 1 }}>{item.label}</span>
            <span style={{ color: 'rgb(var(--muted))', fontSize: '0.75rem' }}>{item.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MOCK_ITEMS = [
  { label: 'Uploaded: Notes - Week 1', time: '2h ago' },
  { label: 'Generated: Notes Brain', time: '1d ago' },
  { label: 'Compared: Notes vs Textbook', time: '2d ago' },
];

export default function RecentActivity() {
  return (
    <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
      <h2 className="text-sm font-medium text-[rgb(var(--text))] mb-3">Recent Activity</h2>
      <ul className="space-y-2">
        {MOCK_ITEMS.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-[rgb(var(--accent))] shrink-0" />
            <span className="text-[rgb(var(--text))] flex-1">{item.label}</span>
            <span className="text-[rgb(var(--muted))] text-xs">{item.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

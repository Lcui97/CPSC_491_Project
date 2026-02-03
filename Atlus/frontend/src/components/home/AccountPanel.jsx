export default function AccountPanel({ welcomeMessage, loading }) {
  return (
    <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
      <h2 className="text-sm font-medium text-[rgb(var(--text))] mb-3">Account</h2>
      <div className="space-y-2 text-sm">
        {loading ? (
          <p className="text-[rgb(var(--muted))]">Loading…</p>
        ) : (
          <p className="text-[rgb(var(--text))]">{welcomeMessage || '—'}</p>
        )}
        <p className="text-[rgb(var(--muted))]">Plan: Local MVP</p>
        <p className="text-[rgb(var(--muted))]">Status: Connected</p>
      </div>
    </div>
  );
}

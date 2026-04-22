export default function AccountPanel({ welcomeMessage, loading }) {
  return (
    <div className="panel-rgb">
      <h2 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgb(var(--text))', margin: '0 0 0.75rem' }}>Account</h2>
      <div style={{ fontSize: '0.875rem' }}>
        {loading ? (
          <p style={{ color: 'rgb(var(--muted))' }}>Loading…</p>
        ) : (
          <p style={{ color: 'rgb(var(--text))' }}>{welcomeMessage || '—'}</p>
        )}
        <p style={{ color: 'rgb(var(--muted))', marginTop: '0.5rem' }}>Plan: Local MVP</p>
        <p style={{ color: 'rgb(var(--muted))' }}>Status: Connected</p>
      </div>
    </div>
  );
}

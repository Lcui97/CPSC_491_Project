import { useNavigate } from 'react-router-dom';

export default function TopBar() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-[rgb(var(--panel))] border-b border-[rgb(var(--border))]">
      <div>
        <span className="font-semibold text-[rgb(var(--text))]">BrainKB</span>
        <span className="ml-2 text-sm text-[rgb(var(--muted))]">Knowledge hub</span>
      </div>
      <button
        type="button"
        onClick={logout}
        className="py-1.5 px-3 rounded-lg text-sm bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--accent))] hover:border-[rgb(var(--accent))] hover:text-white transition-colors"
      >
        Logout
      </button>
    </header>
  );
}

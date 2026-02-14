import { useNavigate } from 'react-router-dom';

/**
 * Header for all brain routes (/brain/:brainId/*). Back button top-left:
 * - If browser has history (length > 1), go back().
 * - Otherwise navigate to /home (brain list).
 */
export default function BrainExplorerHeader({ title, right }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/home', { replace: true });
    }
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))] shrink-0">
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-1.5 text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] transition-colors"
        title="Back to brain list"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </button>
      {title && <span className="text-sm font-medium text-[rgb(var(--text))] truncate">{title}</span>}
      <div className="flex-1" />
      {right}
    </header>
  );
}

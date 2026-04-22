import { useNavigate } from 'react-router-dom';

export default function BrainExplorerHeader({ title, right, backHref, backTitle }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backHref) {
      navigate(backHref);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/home', { replace: true });
    }
  };

  const backBtnTitle = backTitle ?? (backHref ? 'Back' : 'Go back');

  return (
    <header className="explorer-header">
      <button
        type="button"
        onClick={handleBack}
        className="explorer-back"
        title={backBtnTitle}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back
      </button>
      {title ? <span className="explorer-title">{title}</span> : null}
      <div className="explorer-spacer" />
      {right}
    </header>
  );
}

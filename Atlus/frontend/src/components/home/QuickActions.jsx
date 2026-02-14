import { useNavigate } from 'react-router-dom';

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
      <h2 className="text-sm font-medium text-[rgb(var(--text))] mb-3">Quick Actions</h2>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => navigate('/ingest')}
          className="w-full py-2 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium text-left transition-colors"
        >
          Document Ingestion
        </button>
        <button
          type="button"
          onClick={() => navigate('/knowledge-gap')}
          className="w-full py-2 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium text-left transition-colors"
        >
          Knowledge Gap Analysis
        </button>
        <button
          type="button"
          onClick={() => navigate('/brain')}
          className="w-full py-2 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium text-left transition-colors"
        >
          Open Brain Map
        </button>
      </div>
    </div>
  );
}

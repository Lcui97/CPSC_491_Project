import { useNavigate } from 'react-router-dom';

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="panel-rgb">
      <h2 style={{ fontSize: '0.875rem', fontWeight: 500, color: 'rgb(var(--text))', margin: '0 0 0.75rem' }}>Quick Actions</h2>
      <div>
        <button
          type="button"
          onClick={() => navigate('/ingest')}
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: '0.5rem', justifyContent: 'flex-start' }}
        >
          Document Ingestion
        </button>
        <button
          type="button"
          onClick={() => navigate('/knowledge-gap')}
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: '0.5rem', justifyContent: 'flex-start' }}
        >
          Knowledge Gap Analysis
        </button>
        <button
          type="button"
          onClick={() => navigate('/brain')}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'flex-start' }}
        >
          Open Brain Map
        </button>
      </div>
    </div>
  );
}

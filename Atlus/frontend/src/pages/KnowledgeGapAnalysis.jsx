import { Link } from 'react-router-dom';
import TopBar from '../components/home/TopBar';

export default function KnowledgeGapAnalysis() {
  return (
    <div className="ingest-page">
      <TopBar />
      <main style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1rem' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: 'rgb(var(--text))' }}>
            Knowledge Gap Analysis
          </h1>
          <Link to="/home" className="text-link" style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))' }}>
            ← Back to Home
          </Link>
        </div>

        <p style={{ color: 'rgb(var(--muted))', marginBottom: '2rem' }}>
          Compare your notes with textbooks to identify gaps in your understanding. Backend
          integration coming soon.
        </p>

        <div className="kg-grid">
          <div className="panel-rgb">
            <h2 style={{ fontSize: '0.875rem', fontWeight: 500, margin: '0 0 0.75rem', color: 'rgb(var(--text))' }}>Notes</h2>
            <p style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))' }}>
              Select a notes brain or upload notes to compare against your textbook.
            </p>
            <div style={{ marginTop: '1rem', padding: '2rem', border: '2px dashed rgb(var(--border))', borderRadius: '0.5rem', textAlign: 'center', color: 'rgb(var(--muted))', fontSize: '0.875rem' }}>
              Notes selector — coming soon
            </div>
          </div>

          <div className="panel-rgb">
            <h2 style={{ fontSize: '0.875rem', fontWeight: 500, margin: '0 0 0.75rem', color: 'rgb(var(--text))' }}>Textbook</h2>
            <p style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))' }}>
              Select a textbook brain to compare with your notes.
            </p>
            <div style={{ marginTop: '1rem', padding: '2rem', border: '2px dashed rgb(var(--border))', borderRadius: '0.5rem', textAlign: 'center', color: 'rgb(var(--muted))', fontSize: '0.875rem' }}>
              Textbook selector — coming soon
            </div>
          </div>
        </div>

        <div className="panel-rgb" style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 500, margin: '0 0 0.75rem', color: 'rgb(var(--text))' }}>Gap Analysis Results</h2>
          <div style={{ padding: '3rem', border: '2px dashed rgb(var(--border))', borderRadius: '0.5rem', textAlign: 'center', color: 'rgb(var(--muted))', fontSize: '0.875rem' }}>
            Run analysis to see gaps between notes and textbook coverage.
          </div>
        </div>
      </main>
    </div>
  );
}

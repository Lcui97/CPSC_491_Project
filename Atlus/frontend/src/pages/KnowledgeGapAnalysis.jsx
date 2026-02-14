import { Link } from 'react-router-dom';
import TopBar from '../components/home/TopBar';

export default function KnowledgeGapAnalysis() {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-[rgb(var(--text))]">
            Knowledge Gap Analysis
          </h1>
          <Link
            to="/home"
            className="text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        <p className="text-[rgb(var(--muted))] mb-8">
          Compare your notes with textbooks to identify gaps in your understanding. Backend
          integration coming soon.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Notes selection placeholder */}
          <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-6">
            <h2 className="text-sm font-medium text-[rgb(var(--text))] mb-3">Notes</h2>
            <p className="text-sm text-[rgb(var(--muted))]">
              Select a notes brain or upload notes to compare against your textbook.
            </p>
            <div className="mt-4 py-8 border-2 border-dashed border-[rgb(var(--border))] rounded-lg text-center text-[rgb(var(--muted))] text-sm">
              Notes selector — coming soon
            </div>
          </div>

          {/* Textbook selection placeholder */}
          <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-6">
            <h2 className="text-sm font-medium text-[rgb(var(--text))] mb-3">Textbook</h2>
            <p className="text-sm text-[rgb(var(--muted))]">
              Select a textbook brain to compare with your notes.
            </p>
            <div className="mt-4 py-8 border-2 border-dashed border-[rgb(var(--border))] rounded-lg text-center text-[rgb(var(--muted))] text-sm">
              Textbook selector — coming soon
            </div>
          </div>
        </div>

        <div className="mt-8 bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-6">
          <h2 className="text-sm font-medium text-[rgb(var(--text))] mb-3">Gap Analysis Results</h2>
          <div className="py-12 border-2 border-dashed border-[rgb(var(--border))] rounded-lg text-center text-[rgb(var(--muted))] text-sm">
            Run analysis to see gaps between notes and textbook coverage.
          </div>
        </div>
      </main>
    </div>
  );
}

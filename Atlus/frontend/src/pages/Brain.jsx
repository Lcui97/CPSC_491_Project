import { Link } from 'react-router-dom';

export default function Brain() {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] p-6">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-xl font-semibold text-[rgb(var(--text))]">Brain Map</h1>
        <p className="mt-2 text-[rgb(var(--muted))]">Placeholder — graph view coming soon.</p>
        <Link
          to="/home"
          className="inline-block mt-4 py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

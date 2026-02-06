import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Landing() {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[rgb(var(--border))]">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-xl font-semibold text-[rgb(var(--text))]">
            BrainKB
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-[rgb(var(--muted))]">
            <a href="#features" className="hover:text-[rgb(var(--text))] transition-colors">
              Features
            </a>
            <a href="#about" className="hover:text-[rgb(var(--text))] transition-colors">
              About
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-sm text-[rgb(var(--text))] hover:text-[rgb(var(--muted))] transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="py-2 px-4 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))] transition-colors text-sm font-medium"
          >
            Sign up
          </Link>
        </div>
      </header>

      {/* Hero - centered content, no card */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-[rgb(var(--text))] leading-tight">
            The future of knowledge happens together
          </h1>
          <p className="mt-4 text-lg text-[rgb(var(--muted))] max-w-xl mx-auto">
            Tools and trends evolve, but learning endures. With BrainKB, notes, textbooks, and AI come together in one knowledge graph.
          </p>

          {/* Email + CTAs row - GitHub style */}
          <form onSubmit={handleSubmit} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center max-w-xl mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 min-w-0 px-4 py-3 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
            />
            <button
              type="submit"
              className="py-3 px-6 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white font-medium transition-colors whitespace-nowrap"
            >
              Sign up for BrainKB
            </button>
            <Link
              to="/login"
              className="py-3 px-6 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))] transition-colors font-medium text-center whitespace-nowrap"
            >
              Try Brain
            </Link>
          </form>
        </div>
      </main>
    </div>
  );
}

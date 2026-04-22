import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import GeometricBackground from '../components/GeometricBackground';
import AtlusLogo from '../components/AtlusLogo';

export default function Landing() {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    navigate('/login');
  }

  return (
    <GeometricBackground>
      <div className="landing-inner">
        <header className="landing-header">
          <div className="landing-brand">
            <Link to="/" className="landing-logo-link">
              <AtlusLogo size={32} className="atlus-logo-img logo-frame" style={{ borderRadius: '0.75rem' }} />
              Atlus
            </Link>
            <nav className="landing-nav">
              <a href="#features">Features</a>
              <a href="#about">About</a>
            </nav>
          </div>
          <div className="landing-header-actions">
            <Link to="/login" className="landing-signin">
              Sign in
            </Link>
            <Link to="/login" className="landing-cta-outline">
              Sign up
            </Link>
          </div>
        </header>

        <main className="landing-hero">
          <h1>
            The future of knowledge happens together
          </h1>
          <p>
            Turn handwritten pages into structured notes: your scan stays beside the Markdown you edit.
          </p>

          <form onSubmit={handleSubmit} className="landing-form-row">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="landing-email"
            />
            <button type="submit" className="landing-cta">
              Sign up for Atlus
            </button>
            <Link to="/login" className="landing-cta-outline">
              Try Brain
            </Link>
          </form>
        </main>
      </div>
    </GeometricBackground>
  );
}

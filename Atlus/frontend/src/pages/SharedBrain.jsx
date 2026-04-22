import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AtlusLogo from '../components/AtlusLogo';
import { api } from '../api/client';
import { brainKeys } from '../api/brainQueries';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export default function SharedBrain() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [brain, setBrain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    fetch(`${API_URL}/api/share/brain/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((data) => {
        if (data.brain) setBrain(data.brain);
        else setLoadError(true);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleJoin() {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login', { state: { from: { pathname: `/shared/${id}` } } });
      return;
    }
    if (!id) return;
    setJoinError(null);
    setJoining(true);
    try {
      const data = await api(`/api/share/brain/${id}/join`, { method: 'POST', body: '{}' });
      queryClient.invalidateQueries({ queryKey: brainKeys.list() });
      const bid = data.brain_id;
      if (bid) navigate(`/brain/${bid}/notes`);
      else navigate('/home');
    } catch (err) {
      setJoinError(err.message || 'Could not join');
    } finally {
      setJoining(false);
    }
  }

  function handleDownload() {
    if (!brain) return;
    setDownloading(true);
    const payload = {
      name: brain.name,
      badge: brain.badge,
      brain_id: brain.id,
      share_token: id,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${brain.name.replace(/\s+/g, '-')}.atlus-share.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  }

  if (loading) {
    return (
      <div className="shared-page-center">
        <p style={{ color: 'rgb(var(--muted))' }}>Loading…</p>
      </div>
    );
  }

  if (loadError || !brain) {
    return (
      <div className="shared-page-center">
        <div className="shared-stack">
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'rgb(var(--text))', margin: '0 0 0.5rem' }}>
            Link invalid or expired
          </h1>
          <p style={{ color: 'rgb(var(--muted))', margin: '0 0 1.5rem' }}>Ask the owner to generate a new share link from Atlus.</p>
          <Link to="/" className="shared-btn-primary" style={{ display: 'inline-block', width: 'auto', maxWidth: 200, margin: '0 auto' }}>
            Go to Atlus
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-page">
      <header className="shared-header">
        <Link to="/" className="shared-brand">
          <AtlusLogo size={28} className="shared-logo" />
          Atlus
        </Link>
        <Link to="/login" className="shared-link-muted">
          Sign in
        </Link>
      </header>
      <main className="shared-main">
        <div className="shared-card">
          <div className="text-center" style={{ marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'rgb(var(--text))', margin: '0 0 0.25rem' }}>{brain.name}</h1>
            <span style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))' }}>{brain.badge}</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))', margin: '0 0 1.5rem', textAlign: 'center' }}>
            You&apos;ve been invited to this brain. Sign in and join to open notes and handwritten scans.
          </p>
          {joinError ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--red)', textAlign: 'center', margin: '0 0 0.75rem' }}>{joinError}</p>
          ) : null}
          <div className="shared-actions">
            <button type="button" onClick={handleJoin} disabled={joining} className="shared-btn-primary">
              {joining ? 'Joining…' : 'Join brain'}
            </button>
            <button type="button" onClick={handleDownload} disabled={downloading} className="shared-btn-outline">
              {downloading ? 'Downloading…' : 'Download invite JSON'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

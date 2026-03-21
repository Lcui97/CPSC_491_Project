import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import AtlusLogo from '../components/AtlusLogo';
import { api } from '../api/client';

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
    if (!id) return;
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
      .catch(() => setLoadError(true));
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
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex items-center justify-center p-4">
        <p className="text-[rgb(var(--muted))]">Loading…</p>
      </div>
    );
  }

  if (loadError || !brain) {
    return (
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-[rgb(var(--text))] mb-2">Link invalid or expired</h1>
          <p className="text-[rgb(var(--muted))] mb-6">Ask the owner to generate a new share link from Atlus.</p>
          <Link
            to="/"
            className="inline-block py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm"
          >
            Go to Atlus
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 bg-[rgb(var(--panel))] border-b border-[rgb(var(--border))]">
        <Link to="/" className="flex items-center gap-2 font-semibold text-[rgb(var(--text))]">
          <AtlusLogo size={28} className="rounded-[10px] border border-[rgb(var(--border))] bg-black" />
          Atlus
        </Link>
        <Link to="/login" className="text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]">
          Sign in
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-6 shadow-lg">
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-[rgb(var(--text))] mb-1">{brain.name}</h1>
            <span className="text-sm text-[rgb(var(--muted))]">{brain.badge}</span>
          </div>
          <p className="text-sm text-[rgb(var(--muted))] mb-6 text-center">
            You&apos;ve been invited to this brain. Sign in and join to open notes and handwritten scans.
          </p>
          {joinError ? <p className="text-sm text-red-400 text-center mb-3">{joinError}</p> : null}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleJoin}
              disabled={joining}
              className="w-full py-3 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white font-medium transition-colors disabled:opacity-70"
            >
              {joining ? 'Joining…' : 'Join brain'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-3 px-4 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))] font-medium transition-colors disabled:opacity-70"
            >
              {downloading ? 'Downloading…' : 'Download invite JSON'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

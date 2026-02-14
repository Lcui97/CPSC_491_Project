import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

const SHARED_STORAGE_KEY = 'atlus_shared_brains';
const BRAINS_STORAGE_KEY = 'atlus_brains';

function loadBrain(shareId) {
  try {
    const data = JSON.parse(localStorage.getItem(SHARED_STORAGE_KEY) || '{}');
    return data[shareId] || null;
  } catch {
    return null;
  }
}

function loadUserBrains() {
  try {
    const data = localStorage.getItem(BRAINS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveUserBrains(brains) {
  localStorage.setItem(BRAINS_STORAGE_KEY, JSON.stringify(brains));
}

export default function SharedBrain() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [brain, setBrain] = useState(null);
  const [added, setAdded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (id) setBrain(loadBrain(id));
  }, [id]);

  function handleAdd() {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login', { state: { from: { pathname: `/shared/${id}` } } });
      return;
    }
    if (!brain) return;
    const userBrains = loadUserBrains();
    const newBrain = {
      id: String(Date.now()),
      name: brain.name,
      badge: brain.badge || 'Shared',
      shareId: id,
    };
    saveUserBrains([...userBrains, newBrain]);
    setAdded(true);
    setTimeout(() => navigate('/home'), 1500);
  }

  function handleDownload() {
    if (!brain) return;
    setDownloading(true);
    const payload = {
      name: brain.name,
      badge: brain.badge,
      shareId: id,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${brain.name.replace(/\s+/g, '-')}.atlus.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  }

  if (!brain) {
    return (
      <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-[rgb(var(--text))] mb-2">
            Brain not found
          </h1>
          <p className="text-[rgb(var(--muted))] mb-6">
            This brain may have been shared from another device. Cross-device sharing requires
            backend integration.
          </p>
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
        <Link to="/" className="font-semibold text-[rgb(var(--text))]">
          Atlus
        </Link>
        <Link
          to="/login"
          className="text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]"
        >
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
            Someone shared this brain with you. Add it to your collection or download it.
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleAdd}
              disabled={added}
              className="w-full py-3 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white font-medium transition-colors disabled:opacity-70"
            >
              {added ? 'Added! Redirecting…' : 'Add to My Brains'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full py-3 px-4 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--panel2))] font-medium transition-colors disabled:opacity-70"
            >
              {downloading ? 'Downloading…' : 'Download Brain'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

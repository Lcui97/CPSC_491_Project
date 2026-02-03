import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import TopBar from '../components/home/TopBar';
import QuickActions from '../components/home/QuickActions';
import RecentActivity from '../components/home/RecentActivity';
import BrainCards from '../components/home/BrainCards';
import AccountPanel from '../components/home/AccountPanel';

export default function Home() {
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api('/home')
      .then((data) => setWelcomeMessage(data.message || ''))
      .catch(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/login', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <QuickActions />
            <RecentActivity />
          </div>
          <div className="space-y-6">
            <BrainCards />
            <AccountPanel welcomeMessage={welcomeMessage} loading={loading} />
          </div>
        </div>
      </main>
    </div>
  );
}

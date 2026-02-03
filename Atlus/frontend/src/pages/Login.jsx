import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { register, login, googleLogin } from '../api/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/home';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password);
      }
      const data = await login(email, password);
      const token = data.access_token;
      if (!token) {
        setError('No token received');
        return;
      }
      localStorage.setItem('access_token', token);
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || err.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('');
    try {
      const data = await googleLogin(credentialResponse.credential);
      const token = data.access_token;
      if (!token) {
        setError('No token received');
        return;
      }
      localStorage.setItem('access_token', token);
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || err.data?.error || 'Google sign-in failed');
    }
  }

  function handleGoogleError() {
    setError('Google sign-in failed');
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-6 shadow-xl">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-[rgb(var(--text))]">BrainKB</h1>
          <p className="text-sm text-[rgb(var(--muted))] mt-1">Your knowledge base, connected.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isRegister}
            className="w-full px-3 py-2 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
          />
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? '…' : isRegister ? 'Register' : 'Login'}
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister((v) => !v); setError(''); }}
              className="py-2 px-4 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:bg-[rgb(var(--panel2))] transition-colors text-sm"
            >
              {isRegister ? 'Login' : 'Register'}
            </button>
          </div>
        </form>
        {clientId && (
          <div className="mt-4 pt-4 border-t border-[rgb(var(--border))] flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

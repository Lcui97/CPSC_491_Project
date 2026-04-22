import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { register, login, googleLogin, checkBackendHealth } from '../api/auth';
import AtlusLogo from '../components/AtlusLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendOk, setBackendOk] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const from = (location.state?.from?.pathname) || '/home';
  const targetPath = (from && from !== '/login') ? (from.startsWith('/') ? from : `/${from}`) : '/home';

  useEffect(() => {
    checkBackendHealth().then((r) => setBackendOk(r.ok));
  }, []);

  function redirectAfterLogin() {
    navigate(targetPath, { replace: true });
  }

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
      if (!token || typeof token !== 'string') {
        setError('No token received from server');
        setLoading(false);
        return;
      }
      localStorage.setItem('access_token', token);
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
      redirectAfterLogin();
    } catch (err) {
      const msg = err.message || err.data?.error || 'Login failed';
      setError(msg);
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('');
    try {
      const data = await googleLogin(credentialResponse.credential);
      const token = data.access_token;
      if (!token || typeof token !== 'string') {
        setError('No token received from server');
        return;
      }
      localStorage.setItem('access_token', token);
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
      redirectAfterLogin();
    } catch (err) {
      setError(err.message || err.data?.error || 'Google sign-in failed');
    }
  }

  function handleGoogleError() {
    setError('Google sign-in failed');
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const showGoogleLogin = clientId && !isLocalhost;

  return (
    <div className="login-page">
      <div className="login-deco-tr">
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="login-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F5D547" />
              <stop offset="100%" stopColor="#E76F51" />
            </linearGradient>
          </defs>
          <polygon points="100,0 100,100 0,50" fill="url(#login-grad)" />
        </svg>
      </div>
      <div className="login-deco-bl">
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
          <polygon points="0,100 0,0 100,100" fill="#59524F" />
        </svg>
      </div>
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <AtlusLogo size={56} className="atlus-logo-img logo-frame" style={{ borderRadius: '1rem' }} />
          </div>
          <h1>Atlus</h1>
          <p className="tagline">Your knowledge base, connected.</p>
          {backendOk === false && (
            <p className="hint-warn">Backend unreachable. Is the server running on port 5000?</p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="login-form-stack">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="login-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isRegister}
            className="login-input"
          />
          {error && (
            <p className="text-danger" style={{ fontSize: '0.875rem' }} role="alert">{error}</p>
          )}
          <div className="login-actions">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? '…' : isRegister ? 'Register' : 'Login'}
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister((v) => !v); setError(''); }}
              className="btn btn-secondary"
            >
              {isRegister ? 'Login' : 'Register'}
            </button>
          </div>
        </form>
        {showGoogleLogin && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgb(var(--border))', display: 'flex', justifyContent: 'center' }}>
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

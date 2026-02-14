// Use '' so in dev we hit same origin (Vite proxy forwards /api to backend). Set VITE_API_URL for production.
const API_URL = import.meta.env.VITE_API_URL ?? '';

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function request(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.error || res.statusText || 'Request failed';
    throw Object.assign(new Error(message), { status: res.status, data });
  }
  return data;
}

export async function register(email, password) {
  return request('/api/register', { email, password });
}

export async function login(email, password) {
  return request('/api/login', { email, password });
}

export async function googleLogin(credential) {
  return request('/api/auth/google', { credential });
}

/** fetch wrapper: attaches JWT, JSON headers, and bounces to /login on 401. */
const API_URL = import.meta.env.VITE_API_URL ?? '';

function clearTokensAndGoToLogin() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  const path = window.location.pathname || '/';
  if (path !== '/login') {
    window.location.replace('/login');
  }
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('access_token');
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (err) {
    const base = (typeof API_URL === 'string' && API_URL) ? API_URL : window.location.origin;
    throw new Error(`Cannot reach server at ${base}. Is the backend running? (e.g. \`python run.py\` in Atlus/backend)`);
  }
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    const msg = data.error || data.msg || 'Please log in again.';
    const err = new Error(msg);
    err.status = 401;
    err.data = data;
    clearTokensAndGoToLogin();
    throw err;
  }

  if (!res.ok) {
    const message = data.error || data.msg || res.statusText;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/** Multipart POST — optional extra form fields plus files[] or single file. */
export async function apiUpload(path, fields = {}, files = []) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v != null && v !== '') form.append(k, String(v));
  });
  if (Array.isArray(files) && files.length > 0) {
    files.forEach((f) => form.append('files[]', f));
  } else if (files && !Array.isArray(files)) {
    form.append('file', files);
  }
  return api(path, { method: 'POST', body: form });
}

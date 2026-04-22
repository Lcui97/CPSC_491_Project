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

/** POST JSON, receive MP3 blob (OpenAI text-to-speech). */
export async function apiAudioTts(text, voice = 'alloy', signal) {
  const token = localStorage.getItem('access_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_URL}/api/audio/tts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, voice }),
      signal,
    });
  } catch (err) {
    const base = typeof API_URL === 'string' && API_URL ? API_URL : window.location.origin;
    throw new Error(`Cannot reach server at ${base}. Is the backend running?`);
  }
  const ct = res.headers.get('content-type') || '';
  if (res.status === 401) {
    clearTokensAndGoToLogin();
    throw new Error('Please log in again.');
  }
  if (!res.ok) {
    let msg = res.statusText;
    if (ct.includes('application/json')) {
      const j = await res.json().catch(() => ({}));
      msg = j.error || msg;
    } else {
      await res.text().catch(() => '');
    }
    throw new Error(msg);
  }
  return res.blob();
}

/** Multipart upload: audio blob → OpenAI Whisper JSON { text }. */
export async function apiAudioTranscribe(blob) {
  const token = localStorage.getItem('access_token');
  const form = new FormData();
  const name =
    blob.type && blob.type.includes('webm')
      ? 'recording.webm'
      : blob.type && blob.type.includes('mp4')
        ? 'recording.m4a'
        : 'recording.webm';
  form.append('file', blob, name);
  let res;
  try {
    res = await fetch(`${API_URL}/api/audio/transcribe`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch (err) {
    const base = typeof API_URL === 'string' && API_URL ? API_URL : window.location.origin;
    throw new Error(`Cannot reach server at ${base}. Is the backend running?`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearTokensAndGoToLogin();
    throw new Error('Please log in again.');
  }
  if (!res.ok) {
    throw new Error(data.error || res.statusText);
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

/**
 * Multipart POST with upload progress callback (0-100).
 * Uses XHR because fetch doesn't expose upload progress.
 */
export function apiUploadWithProgress(path, fields = {}, files = [], onProgress = null) {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v != null && v !== '') form.append(k, String(v));
  });
  if (Array.isArray(files) && files.length > 0) {
    files.forEach((f) => form.append('files[]', f));
  } else if (files && !Array.isArray(files)) {
    form.append('file', files);
  }

  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('access_token');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${path}`, true);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress(pct);
    };

    xhr.onerror = () => {
      reject(new Error('Network error while uploading file.'));
    };

    xhr.onload = () => {
      let data = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = {};
      }

      if (xhr.status === 401) {
        clearTokensAndGoToLogin();
        reject(new Error(data.error || data.msg || 'Please log in again.'));
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const err = new Error(data.error || data.msg || `Upload failed (${xhr.status})`);
        err.status = xhr.status;
        err.data = data;
        reject(err);
        return;
      }

      if (onProgress) onProgress(100);
      resolve(data);
    };

    xhr.send(form);
  });
}

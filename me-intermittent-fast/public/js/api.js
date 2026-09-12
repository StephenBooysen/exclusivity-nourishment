const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body && body.error) || `Request failed: ${res.status}`);
  }
  return body;
}

const get = (path) => request(path);
const post = (path, data) => request(path, { method: 'POST', body: JSON.stringify(data || {}) });
const put = (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) });

export const api = {
  dashboard: {
    get: () => get('/dashboard')
  },
  plan: {
    get: () => get('/plan'),
    update: (data) => put('/plan', data),
    start: (data) => post('/plan/start', data)
  },
  fasts: {
    list: (limit = 20) => get(`/fasts?limit=${limit}`),
    active: () => get('/fasts/active'),
    start: () => post('/fasts/start'),
    end: () => post('/fasts/end'),
    cancel: () => post('/fasts/cancel'),
    addNote: (text) => post('/fasts/notes', { text })
  },
  history: {
    get: () => get('/history')
  },
  settings: {
    get: () => get('/settings'),
    update: (data) => put('/settings', data)
  },
  activity: {
    recent: (limit = 20) => get(`/activity?limit=${limit}`)
  }
};

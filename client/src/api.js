const TOKEN_KEY = 'ajaia_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new Error('Cannot reach the server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  users: () => request('/users'),
  login: (email) => request('/login', { method: 'POST', body: { email } }),
  me: () => request('/me'),
  list: () => request('/documents'),
  create: (title) => request('/documents', { method: 'POST', body: { title } }),
  get: (id) => request(`/documents/${id}`),
  update: (id, patch) => request(`/documents/${id}`, { method: 'PATCH', body: patch }),
  remove: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  shares: (id) => request(`/documents/${id}/shares`),
  share: (id, email, role) => request(`/documents/${id}/shares`, { method: 'POST', body: { email, role } }),
  unshare: (id, userId) => request(`/documents/${id}/shares/${userId}`, { method: 'DELETE' }),
  importFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/documents/import', { method: 'POST', form });
  },
};

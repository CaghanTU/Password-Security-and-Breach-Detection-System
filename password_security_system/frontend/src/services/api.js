// All requests use credentials:'include' so the HttpOnly cookie is sent automatically.
// No token management in JS — the browser handles it.

const BASE = ''  // same origin via Vite proxy

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : null
  if (!res.ok) {
    const msg = data?.detail || `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

// ── Auth ──────────────────────────────────────────────────────────────
export const api = {
  register: (username, master_password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, master_password }) }),

  login: (username, master_password, totp_code) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, master_password, totp_code }) }),

  logout: () =>
    request('/auth/logout', { method: 'POST' }),

  setup2fa: () =>
    request('/auth/2fa/setup', { method: 'POST' }),

  verify2fa: (code) =>
    request('/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) }),

  // ── Passwords ───────────────────────────────────────────────────────
  getPasswords: (category) =>
    request('/passwords' + (category ? `?category=${encodeURIComponent(category)}` : '')),

  addPassword: (body) =>
    request('/passwords', { method: 'POST', body: JSON.stringify(body) }),

  updatePassword: (id, body) =>
    request(`/passwords/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  deletePassword: (id) =>
    request(`/passwords/${id}`, { method: 'DELETE' }),

  getPasswordHistory: (id) =>
    request(`/passwords/${id}/history`),

  // ── Breach ──────────────────────────────────────────────────────────
  checkEmail: (email) =>
    request('/breach/email', { method: 'POST', body: JSON.stringify({ email }) }),

  checkPassword: (password) =>
    request('/breach/password', { method: 'POST', body: JSON.stringify({ password }) }),

  // ── Generator ───────────────────────────────────────────────────────
  generate: (opts) =>
    request('/generator/generate', { method: 'POST', body: JSON.stringify(opts) }),

  // ── Score ────────────────────────────────────────────────────────────
  getScore: () => request('/score'),
  getScoreHistory: () => request('/score/history'),

  // ── Export ───────────────────────────────────────────────────────────
  exportVault: () => request('/export'),

  importVault: (payload) =>
    request('/export/import', { method: 'POST', body: JSON.stringify(payload) }),

  // ── Audit ────────────────────────────────────────────────────────────
  getAudit: (page = 1, per_page = 20) =>
    request(`/audit?page=${page}&per_page=${per_page}`),

  deleteAudit: (dateFrom, dateTo) => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo)   params.set('date_to', dateTo)
    const qs = params.toString() ? '?' + params.toString() : ''
    return request(`/audit${qs}`, { method: 'DELETE' })
  },
}

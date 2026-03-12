import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export default function LoginPage() {
  const { login } = useAuth()
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', totp: '' })
  const [show2fa, setShow2fa] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.username, form.password, show2fa ? form.totp : undefined)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      await api.register(form.username, form.password)
      setSuccess('Kayıt başarılı! Giriş yapabilirsiniz.')
      setTab('login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100">
      <div className="card border-0 shadow-lg px-4 py-4" style={{ width: 420 }}>
        <h3 className="text-center mb-4 text-primary fw-bold">🔐 Password Security System</h3>

        <ul className="nav nav-pills nav-fill mb-4">
          {['login', 'register'].map(t => (
            <li className="nav-item" key={t}>
              <button
                className={`nav-link ${tab === t ? 'active' : 'text-secondary'}`}
                onClick={() => { setTab(t); setError(''); setSuccess('') }}
              >
                {t === 'login' ? 'Giriş' : 'Kayıt Ol'}
              </button>
            </li>
          ))}
        </ul>

        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-semibold text-light">Kullanıcı Adı</label>
              <input className="form-control"
                type="text" required autoComplete="username"
                value={form.username} onChange={set('username')} />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold text-light">Master Şifre</label>
              <input className="form-control"
                type="password" required autoComplete="current-password"
                value={form.password} onChange={set('password')} />
            </div>
            <div className="form-check mb-3">
              <input className="form-check-input" type="checkbox" id="show2fa"
                checked={show2fa} onChange={e => setShow2fa(e.target.checked)} />
              <label className="form-check-label text-secondary" htmlFor="show2fa">
                2FA etkin (kodu gir)
              </label>
            </div>
            {show2fa && (
              <div className="mb-3">
                <input className="form-control"
                  type="text" placeholder="6 haneli kod" maxLength={6}
                  autoComplete="one-time-code"
                  value={form.totp} onChange={set('totp')} />
              </div>
            )}
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <button className="btn btn-primary w-100" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm" /> : 'Giriş Yap'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="mb-3">
              <label className="form-label fw-semibold text-light">Kullanıcı Adı</label>
              <input className="form-control"
                type="text" required autoComplete="username"
                value={form.username} onChange={set('username')} />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold text-light">Master Şifre</label>
              <input className="form-control"
                type="password" required autoComplete="new-password"
                value={form.password} onChange={set('password')} />
            </div>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            {success && <div className="alert alert-success py-2">{success}</div>}
            <button className="btn btn-success w-100" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm" /> : 'Hesap Oluştur'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

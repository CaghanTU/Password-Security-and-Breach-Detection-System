import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export default function LoginPage() {
  const { login } = useAuth()
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ username: '', password: '', totp: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // 2FA setup state (shown after registration)
  const [setupData, setSetupData] = useState(null) // { qr_image, secret }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.username, form.password, form.totp || undefined)
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
      const data = await api.register(form.username, form.password)
      setSetupData({ qr_image: data.qr_image, secret: data.secret })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // After registration: show QR code screen
  if (setupData) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="card border-0 shadow-lg px-4 py-4 text-center" style={{ width: 460 }}>
          <h4 className="text-primary fw-bold mb-2">2FA Setup</h4>
          <p className="text-secondary small mb-3">
            To secure your account, download Google Authenticator or Authy and scan the QR code below.
          </p>

          <img src={setupData.qr_image} alt="2FA QR Code" className="img-fluid mb-3 rounded mx-auto d-block" style={{ maxWidth: 220 }} />

          <p className="text-secondary small mb-1">Manual entry secret:</p>
          <code className="text-info d-block mb-4" style={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{setupData.secret}</code>

          <div className="alert alert-warning py-2 small mb-3">
            Save this code! You will need the 6-digit code from your authenticator app every time you log in.
          </div>

          <button
            className="btn btn-primary w-100"
            onClick={() => {
              setSetupData(null)
              setTab('login')
              setForm(f => ({ ...f, totp: '' }))
              setSuccess('Registration and 2FA setup complete! You can now log in.')
              setError('')
            }}
          >
            Got it, Log In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100">
      <div className="card border-0 shadow-lg px-4 py-4" style={{ width: 420 }}>
        <h3 className="text-center mb-4 text-primary fw-bold">Password Security System</h3>
        <p className="text-center text-secondary small mb-4">Manage your passwords securely, detect breaches instantly.</p>

        <ul className="nav nav-pills nav-fill mb-4">
          {['login', 'register'].map(t => (
            <li className="nav-item" key={t}>
              <button
                className={`nav-link ${tab === t ? 'active' : 'text-secondary'}`}
                onClick={() => { setTab(t); setError(''); setSuccess('') }}
              >
                {t === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            </li>
          ))}
        </ul>

        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-semibold text-light">Username</label>
              <input className="form-control"
                type="text" required autoComplete="username"
                value={form.username} onChange={set('username')} />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold text-light">Master Password</label>
              <input className="form-control"
                type="password" required autoComplete="current-password"
                value={form.password} onChange={set('password')} />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold text-light">2FA Code</label>
              <input className="form-control"
                type="text" required placeholder="6-digit code from your authenticator app"
                maxLength={6} autoComplete="one-time-code"
                value={form.totp} onChange={set('totp')} />
            </div>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            {success && <div className="alert alert-success py-2">{success}</div>}
            <button className="btn btn-primary w-100" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm" /> : 'Log In'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="mb-3">
              <label className="form-label fw-semibold text-light">Username</label>
              <input className="form-control"
                type="text" required autoComplete="username"
                value={form.username} onChange={set('username')} />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold text-light">Master Password</label>
              <input className="form-control"
                type="password" required autoComplete="new-password"
                value={form.password} onChange={set('password')} />
            </div>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <button className="btn btn-success w-100" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm" /> : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

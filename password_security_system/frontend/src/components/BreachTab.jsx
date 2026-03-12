import { useState } from 'react'
import { api } from '../services/api'

const DATA_CLASS_META = {
  'Passwords':             { color: '#dc3545', icon: '🔑' },
  'Email addresses':       { color: '#fd7e14', icon: '✉️' },
  'Usernames':             { color: '#ffc107', icon: '👤' },
  'IP addresses':          { color: '#6f42c1', icon: '🌐' },
  'Phone numbers':         { color: '#0dcaf0', icon: '📱' },
  'Dates of birth':        { color: '#20c997', icon: '🎂' },
  'Names':                 { color: '#6c757d', icon: '📝' },
  'Geographic locations':  { color: '#198754', icon: '📍' },
  'Social media profiles': { color: '#0d6efd', icon: '💬' },
  'Credit cards':          { color: '#dc3545', icon: '💳' },
}

function DataTag({ label }) {
  const meta = DATA_CLASS_META[label] || { color: '#6c757d', icon: '📄' }
  return (
    <span
      className="badge me-1 mb-1"
      style={{
        background: meta.color + '22',
        color: meta.color,
        border: `1px solid ${meta.color}55`,
        fontSize: '0.75rem',
        fontWeight: 500,
      }}
    >
      {meta.icon} {label}
    </span>
  )
}

function BreachCard({ b, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  const dateStr = b.breach_date
    ? new Date(b.breach_date + 'T00:00:00').toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })
    : 'Tarih bilinmiyor'

  const logoUrl = b.logo_path || null

  /* strip HTML from description */
  const plainDesc = b.description
    ? b.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : null

  return (
    <div className="mb-3 rounded overflow-hidden" style={{ background: '#1a1d27', border: '1px solid #2d3148' }}>
      {/* Header row */}
      <div
        className="d-flex align-items-center gap-3 p-3"
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen(v => !v)}
      >
        {/* Logo */}
        <div
          className="rounded flex-shrink-0 d-flex align-items-center justify-content-center"
          style={{ width: 48, height: 48, background: '#2a2d3e', overflow: 'hidden' }}
        >
          {logoUrl
            ? <img src={logoUrl} alt={b.title} style={{ width: 40, height: 40, objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = '🔓' }} />
            : <span style={{ fontSize: '1.4rem' }}>🔓</span>
          }
        </div>

        {/* Name + date + badges */}
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-bold" style={{ color: '#e2e8f0' }}>{b.title || b.name}</div>
          <div className="d-flex flex-wrap align-items-center gap-1 mt-1">
            <span className="small" style={{ color: '#a0aec0' }}>{dateStr}</span>
            {b.pwn_count > 0 && (
              <span className="badge small" style={{ background: '#dc354522', color: '#dc3545', border: '1px solid #dc354555' }}>
                {b.pwn_count.toLocaleString()} hesap
              </span>
            )}
            {b.is_sensitive && (
              <span className="badge small" style={{ background: '#6f42c122', color: '#c070ff', border: '1px solid #6f42c155' }}>
                hassas
              </span>
            )}
            {b.is_verified === false && (
              <span className="badge small text-secondary" style={{ background: '#2a2d3e', border: '1px solid #6c757d44' }}>
                doğrulanmamış
              </span>
            )}
          </div>
        </div>

        {/* Data class summary (desktop) */}
        <div className="d-none d-md-flex flex-wrap justify-content-end" style={{ maxWidth: 260 }}>
          {b.data_classes.slice(0, 4).map(dc => <DataTag key={dc} label={dc} />)}
          {b.data_classes.length > 4 && (
            <span className="badge text-secondary" style={{ background: '#2a2d3e', fontSize: '0.75rem' }}>
              +{b.data_classes.length - 4} daha
            </span>
          )}
        </div>

        <span style={{ color: '#6c757d', fontSize: '0.75rem', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4" style={{ borderTop: '1px solid #2d3148' }}>
          <div className="mt-3">
            <div className="small fw-semibold mb-2" style={{ color: '#6c757d', letterSpacing: '0.05em' }}>
              SIZDIRILAN VERİLER
            </div>
            <div className="d-flex flex-wrap">
              {b.data_classes.map(dc => <DataTag key={dc} label={dc} />)}
            </div>
          </div>

          {plainDesc && (
            <div className="mt-3">
              <div className="small fw-semibold mb-1" style={{ color: '#6c757d', letterSpacing: '0.05em' }}>
                OLAY AÇIKLAMASI
              </div>
              <p className="small mb-0" style={{ color: '#a0aec0', lineHeight: 1.6 }}>{plainDesc}</p>
            </div>
          )}

          <div className="mt-3 d-flex flex-wrap gap-3 small" style={{ color: '#6c757d' }}>
            {b.domain && <span>🌐 {b.domain}</span>}
            {b.breach_date && <span>📅 {dateStr}</span>}
            {b.pwn_count > 0 && <span>👥 {b.pwn_count.toLocaleString()} hesap etkilendi</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function BreachHistory({ result }) {
  if (!result || !result.email) {
    return <div className="alert alert-warning mt-4">Invalid response from server</div>
  }
  
  const { email, breaches } = result

  if (!breaches || !Array.isArray(breaches) || breaches.length === 0) {
    return (
      <div className="alert alert-success mt-4 d-flex align-items-center gap-2">
        <span style={{ fontSize: '1.5rem' }}>✅</span>
        <div><strong>{email}</strong> için bilinen ihlallerde kayıt bulunamadı.</div>
      </div>
    )
  }

  const sorted = [...breaches].sort((a, b) => (b.breach_date || '').localeCompare(a.breach_date || ''))

  return (
    <div className="mt-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h5 className="mb-0">İhlal Geçmişin</h5>
          <small style={{ color: '#a0aec0' }}>{email} · {breaches.length} ihlal tespit edildi</small>
        </div>
        <span className="badge bg-danger fs-6 px-3 py-2">{breaches.length} ihlal</span>
      </div>

      {/* Column headers */}
      <div className="d-none d-md-flex align-items-center px-3 pb-2 small fw-bold"
        style={{ color: '#6c757d', borderBottom: '1px solid #2d3148', gap: 12 }}>
        <span style={{ width: 48, flexShrink: 0 }} />
        <span className="flex-grow-1">İhlal</span>
        <span style={{ width: 260, textAlign: 'right' }}>Sızdırılan Veriler</span>
        <span style={{ width: 24 }} />
      </div>

      <div className="mt-2">
        {sorted.map((b, i) => <BreachCard key={b.name} b={b} defaultOpen={i === 0} />)}
      </div>
    </div>
  )
}

export default function BreachTab() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailResult, setEmailResult] = useState(null)
  const [pwResult, setPwResult] = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [pwError, setPwError] = useState('')

  async function checkEmail(e) {
    e.preventDefault()
    setEmailError(''); setEmailResult(null); setEmailLoading(true)
    try { setEmailResult(await api.checkEmail(email)) }
    catch (err) { setEmailError(err.message) }
    finally { setEmailLoading(false) }
  }

  async function checkPassword(e) {
    e.preventDefault()
    setPwError(''); setPwResult(null); setPwLoading(true)
    try { setPwResult(await api.checkPassword(password)) }
    catch (err) { setPwError(err.message) }
    finally { setPwLoading(false) }
  }

  return (
    <div>
      {/* Search panels */}
      <div className="row g-3 mb-2">
        {/* Email */}
        <div className="col-md-7">
          <div className="card p-4">
            <h5 className="mb-3">✉️ E-posta İhlal Kontrolü</h5>
            <form onSubmit={checkEmail} className="d-flex gap-2">
              <input className="form-control" type="email" required placeholder="ornek@email.com"
                value={email} onChange={e => setEmail(e.target.value)} />
              <button className="btn btn-warning px-4 flex-shrink-0" disabled={emailLoading}>
                {emailLoading ? <span className="spinner-border spinner-border-sm" /> : 'Tara'}
              </button>
            </form>
            {emailError && <div className="alert alert-danger mt-3 py-2">{emailError}</div>}
          </div>
        </div>

        {/* Password */}
        <div className="col-md-5">
          <div className="card p-4">
            <h5 className="mb-3">🔑 Şifre Kontrolü <small className="text-secondary fs-6">(k-anonimlik)</small></h5>
            <form onSubmit={checkPassword} className="d-flex gap-2">
              <input className="form-control" type="password" required placeholder="Şifrenizi girin"
                value={password} onChange={e => setPassword(e.target.value)} />
              <button className="btn btn-warning px-4 flex-shrink-0" disabled={pwLoading}>
                {pwLoading ? <span className="spinner-border spinner-border-sm" /> : 'Tara'}
              </button>
            </form>
            {pwError && <div className="alert alert-danger mt-2 py-2">{pwError}</div>}
            {pwResult && (
              <div className={`alert mt-2 py-2 ${pwResult.pwned ? 'alert-danger' : 'alert-success'}`}>
                {pwResult.pwned
                  ? <>⚠️ Bu şifre <strong>{pwResult.count.toLocaleString()}</strong> kez ihlal edilmiş!</>
                  : '✅ Bilinen ihlallerde bu şifre bulunamadı.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed breach history */}
      {emailResult && <BreachHistory result={emailResult} />}
    </div>
  )
}

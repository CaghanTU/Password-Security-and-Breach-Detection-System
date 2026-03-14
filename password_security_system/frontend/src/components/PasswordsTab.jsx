import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

const CATEGORIES = ['', 'email', 'banking', 'social', 'work', 'other']
const CAT_LABELS  = { '': 'All', email: 'Email', banking: 'Banking', social: 'Social', work: 'Work', other: 'Other' }

function StrengthBadge({ label }) {
  return <span className={`badge badge-${label}`}>{label}</span>
}

function CredentialRow({ cred, onEdit, onDelete }) {
  const [show, setShow] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const sinceUpdate = cred.updated_at
    ? Math.floor((Date.now() - new Date(cred.updated_at)) / (1000 * 60 * 60 * 24)
    ) : null

  return (
    <div className="card mb-2">
      {/* Main row */}
      <div
        className="p-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div>
          <span className="fw-semibold">{cred.site_name}</span>
          <span className="badge bg-secondary ms-2 text-uppercase">{cred.category}</span>
          {cred.is_stale && <span className="badge bg-warning text-dark ms-1">Stale</span>}
          {cred.is_breached && (
            <span className="badge bg-danger ms-1">
              Password Breached{cred.breach_count > 0 ? ` (${cred.breach_count.toLocaleString()}x)` : ''}
            </span>
          )}
          {cred.email_breached && (
            <span className="badge bg-danger ms-1">
              Email Breached ({cred.email_breach_count} breaches)
            </span>
          )}
          {cred.breach_date_status === 'not_rotated' && <span className="badge bg-danger ms-1">Not Updated</span>}
          {cred.breach_date_status === 'changed_after' && <span className="badge bg-success ms-1">Updated</span>}
          <br />
          <small className="text-secondary">{cred.site_username}</small>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
          <StrengthBadge label={cred.strength_label} />
          <code
            className="pw-mono text-info"
            title="Show / Hide"
            onClick={() => setShow(s => !s)}
          >
            {show ? cred.password : '••••••••'}
          </code>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(cred)}>Edit</button>
          <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(cred.id)}>Delete</button>
        </div>
      </div>

      {/* Detail panel */}
      {expanded && (
        <div className="px-3 pb-3 pt-0" style={{ borderTop: '1px solid #2d3148' }}>
          <div className="d-flex flex-column gap-2 mt-2 small">
            <div className="p-2 rounded d-flex justify-content-between align-items-center" style={{ background: '#0f1117' }}>
              <span className="text-secondary">Strength</span>
              <StrengthBadge label={cred.strength_label} />
            </div>
            <div className="p-2 rounded d-flex justify-content-between align-items-center" style={{ background: '#0f1117' }}>
              <span className="text-secondary">Password Age</span>
              <strong>{sinceUpdate !== null ? `${sinceUpdate} days` : '—'}</strong>
            </div>
            <div className="p-2 rounded d-flex justify-content-between align-items-center" style={{ background: '#0f1117' }}>
              <span className="text-secondary">Password Breach</span>
              {cred.is_breached
                ? <strong className="text-danger">Yes — found {cred.breach_count.toLocaleString()} times</strong>
                : <strong className="text-success">No</strong>
              }
            </div>
            <div className="p-2 rounded d-flex justify-content-between align-items-center" style={{ background: '#0f1117' }}>
              <span className="text-secondary">Email Breach</span>
              {cred.email_breached
                ? <strong className="text-danger">Yes — {cred.email_breach_count} different breaches</strong>
                : cred.site_username.includes('@')
                  ? <strong className="text-success">No</strong>
                  : <span className="text-secondary">Not an email</span>
              }
            </div>
            <div className="p-2 rounded d-flex justify-content-between align-items-center" style={{ background: '#0f1117' }}>
              <span className="text-secondary">Created</span>
              <span>{new Date(cred.created_at).toLocaleString()}</span>
            </div>
            <div className="p-2 rounded d-flex justify-content-between align-items-center" style={{ background: '#0f1117' }}>
              <span className="text-secondary">Updated</span>
              <span>{new Date(cred.updated_at).toLocaleString()}</span>
            </div>
            {(cred.is_breached || cred.email_breached) && (
              <div className="alert alert-danger py-2 mb-0 small">
                {cred.is_breached && <div>Your password was found <strong>{cred.breach_count.toLocaleString()}</strong> times in breach databases. We recommend changing it immediately.</div>}
                {cred.email_breached && <div>This email appeared in <strong>{cred.email_breach_count}</strong> different breaches. You should set a new password.</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CredentialModal({ show, initial, onClose, onSave }) {
  const [form, setForm] = useState({ site_name: '', site_username: '', password: '', category: 'other' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const isEdit = !!initial

  useEffect(() => {
    if (initial) setForm({ site_name: initial.site_name, site_username: initial.site_username, password: '', category: initial.category })
    else setForm({ site_name: '', site_username: '', password: '', category: 'other' })
    setError('')
    setShowPw(false)
  }, [initial, show])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (isEdit) {
        const body = { site_name: form.site_name, site_username: form.site_username, category: form.category }
        if (form.password) body.password = form.password
        await api.updatePassword(initial.id, body)
      } else {
        await api.addPassword(form)
      }
      onSave()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null
  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,.7)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content card border-0">
          <div className="modal-header border-secondary">
            <h5 className="modal-title">{isEdit ? 'Edit Credential' : 'New Credential'}</h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Site / App Name</label>
                <input className="form-control" required value={form.site_name} onChange={set('site_name')} />
              </div>
              <div className="mb-3">
                <label className="form-label">Username / Email</label>
                <input className="form-control" required value={form.site_username} onChange={set('site_username')} />
              </div>
              <div className="mb-3">
                <label className="form-label">{isEdit ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                <div className="input-group">
                  <input className="form-control" type={showPw ? 'text' : 'password'}
                    required={!isEdit} value={form.password} onChange={set('password')} />
                  <button type="button" className="btn btn-outline-secondary"
                    onClick={() => setShowPw(v => !v)}>{showPw ? 'Hide' : 'Show'}</button>
                </div>
                <small className="text-secondary">HIBP breach check is performed automatically on save.</small>
              </div>
              <div className="mb-3">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={set('category')}>
                  {['other','email','banking','social','work'].map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
              {error && <div className="alert alert-danger py-2">{error}</div>}
            </div>
            <div className="modal-footer border-secondary">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm" /> : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function PasswordsTab() {
  const [creds, setCreds] = useState([])
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ show: false, initial: null })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCreds(await api.getPasswords(category || undefined))
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!confirm('Delete this credential?')) return
    await api.deletePassword(id)
    load()
  }

  return (
    <div>
      <div className="d-flex gap-2 align-items-center mb-3 flex-wrap">
        <select className="form-select" style={{ maxWidth: 180 }}
          value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setModal({ show: true, initial: null })}>
          + Add
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : creds.length === 0 ? (
        <p className="text-secondary">No credentials yet. Start by adding your first password!</p>
      ) : (
        creds.map(c => (
          <CredentialRow key={c.id} cred={c}
            onEdit={cred => setModal({ show: true, initial: cred })}
            onDelete={handleDelete}
          />
        ))
      )}

      <CredentialModal
        show={modal.show}
        initial={modal.initial}
        onClose={() => setModal({ show: false, initial: null })}
        onSave={load}
      />
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

const CATEGORIES = ['', 'email', 'banking', 'social', 'work', 'other']
const CAT_LABELS  = { '': 'Tümü', email: 'E-posta', banking: 'Bankacılık', social: 'Sosyal', work: 'İş', other: 'Diğer' }

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
      {/* Ana satır */}
      <div
        className="p-3 d-flex align-items-center justify-content-between flex-wrap gap-2"
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div>
          <span className="fw-semibold">{cred.site_name}</span>
          <span className="badge bg-secondary ms-2 text-uppercase">{cred.category}</span>
          {cred.is_stale && <span className="badge bg-warning text-dark ms-1">Eski</span>}
          {cred.is_breached && (
            <span className="badge bg-danger ms-1">
              ⚠ Şifre İhlal{cred.breach_count > 0 ? ` (${cred.breach_count.toLocaleString()}×)` : ''}
            </span>
          )}
          {cred.email_breached && (
            <span className="badge bg-danger ms-1">
              ✉ E-posta İhlal ({cred.email_breach_count} ihlal)
            </span>
          )}
          {cred.breach_date_status === 'not_rotated' && <span className="badge bg-danger ms-1">Güncellenmedi ✗</span>}
          {cred.breach_date_status === 'changed_after' && <span className="badge bg-success ms-1">Güncellendi ✓</span>}
          <br />
          <small className="text-secondary">{cred.site_username}</small>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
          <StrengthBadge label={cred.strength_label} />
          <code
            className="pw-mono text-info"
            title="Göster / Gizle"
            onClick={() => setShow(s => !s)}
          >
            {show ? cred.password : '••••••••'}
          </code>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(cred)}>Düzenle</button>
          <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(cred.id)}>Sil</button>
        </div>
      </div>

      {/* Detay paneli */}
      {expanded && (
        <div className="px-3 pb-3 pt-0" style={{ borderTop: '1px solid #2d3148' }}>
          <div className="row mt-2 g-2 small">
            <div className="col-md-4">
              <div className="p-2 rounded" style={{ background: '#0f1117' }}>
                <span className="text-secondary">Güç: </span>
                <StrengthBadge label={cred.strength_label} />
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-2 rounded" style={{ background: '#0f1117' }}>
                <span className="text-secondary">Yaş: </span>
                <strong>{sinceUpdate !== null ? `${sinceUpdate} gün` : '—'}</strong>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-2 rounded" style={{ background: '#0f1117' }}>
                <span className="text-secondary">Şifre ihlali: </span>
                {cred.is_breached
                  ? <strong className="text-danger">Evet — {cred.breach_count.toLocaleString()} kez görülmüş</strong>
                  : <strong className="text-success">Hayır</strong>
                }
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-2 rounded" style={{ background: '#0f1117' }}>
                <span className="text-secondary">E-posta ihlali: </span>
                {cred.email_breached
                  ? <strong className="text-danger">Evet — {cred.email_breach_count} farklı ihlal</strong>
                  : cred.site_username.includes('@')
                    ? <strong className="text-success">Hayır</strong>
                    : <span className="text-secondary">E-posta değil</span>
                }
              </div>
            </div>
            <div className="col-12">
              <div className="p-2 rounded" style={{ background: '#0f1117' }}>
                <span className="text-secondary">Oluşturuldu: </span>
                {new Date(cred.created_at).toLocaleString('tr-TR')}
                <span className="ms-3 text-secondary">Güncellendi: </span>
                {new Date(cred.updated_at).toLocaleString('tr-TR')}
              </div>
            </div>
            {(cred.is_breached || cred.email_breached) && (
              <div className="col-12">
                <div className="alert alert-danger py-2 mb-0 small">
                  {cred.is_breached && <div>⚠ Şifre <strong>{cred.breach_count.toLocaleString()}</strong> kez ihlal veritabanında. Hemen değiştirin.</div>}
                  {cred.email_breached && <div>✉ Bu e-posta <strong>{cred.email_breach_count}</strong> farklı ihlalde görünmüş. Yeni şifre belirleyin.</div>}
                </div>
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
            <h5 className="modal-title">{isEdit ? 'Düzenle' : 'Yeni Credential'}</h5>
            <button className="btn-close btn-close-white" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Site / Uygulama Adı</label>
                <input className="form-control" required value={form.site_name} onChange={set('site_name')} />
              </div>
              <div className="mb-3">
                <label className="form-label">Kullanıcı Adı / E-posta</label>
                <input className="form-control" required value={form.site_username} onChange={set('site_username')} />
              </div>
              <div className="mb-3">
                <label className="form-label">{isEdit ? 'Yeni Şifre (boş bırakırsan değişmez)' : 'Şifre'}</label>
                <div className="input-group">
                  <input className="form-control" type={showPw ? 'text' : 'password'}
                    required={!isEdit} value={form.password} onChange={set('password')} />
                  <button type="button" className="btn btn-outline-secondary"
                    onClick={() => setShowPw(v => !v)}>{showPw ? '🙈' : '👁'}</button>
                </div>
                <small className="text-secondary">Kayıt sırasında HIBP ihlal kontrolü otomatik yapılır.</small>
              </div>
              <div className="mb-3">
                <label className="form-label">Kategori</label>
                <select className="form-select" value={form.category} onChange={set('category')}>
                  {['other','email','banking','social','work'].map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
              {error && <div className="alert alert-danger py-2">{error}</div>}
            </div>
            <div className="modal-footer border-secondary">
              <button type="button" className="btn btn-secondary" onClick={onClose}>İptal</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm" /> : 'Kaydet'}
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
    if (!confirm('Bu credential silinsin mi?')) return
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
          + Ekle
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : creds.length === 0 ? (
        <p className="text-secondary">Henüz kayıt yok.</p>
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

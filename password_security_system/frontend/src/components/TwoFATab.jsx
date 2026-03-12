import { useState } from 'react'
import { api } from '../services/api'

export default function TwoFATab() {
  const [qr, setQr] = useState(null)
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  async function setup() {
    setMsg(null); setLoading(true)
    try {
      const data = await api.setup2fa()
      setQr(data.qr_image)
      setSecret(data.secret)
    } catch (err) {
      setMsg({ type: 'danger', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function verify(e) {
    e.preventDefault()
    setMsg(null); setLoading(true)
    try {
      await api.verify2fa(code)
      setMsg({ type: 'success', text: '✓ Kod doğrulandı! 2FA aktif.' })
    } catch (err) {
      setMsg({ type: 'danger', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-4 text-center" style={{ maxWidth: 420 }}>
      <h5 className="mb-2">İki Faktörlü Kimlik Doğrulama</h5>
      <p className="text-secondary small mb-4">
        QR kodu Google Authenticator veya Authy ile tarayın.
      </p>

      <button className="btn btn-primary mb-4" onClick={setup} disabled={loading}>
        {loading ? <span className="spinner-border spinner-border-sm" /> : 'QR Kod Oluştur'}
      </button>

      {qr && (
        <div className="mb-4">
          <img src={qr} alt="2FA QR Code" className="img-fluid mb-2 rounded" style={{ maxWidth: 220 }} />
          <p className="text-secondary small">
            Manuel giriş için secret: <code className="text-info">{secret}</code>
          </p>
        </div>
      )}

      <hr className="border-secondary" />
      <h6 className="mb-3">Kodu Doğrula</h6>
      <form onSubmit={verify}>
        <input
          className="form-control text-center mb-3"
          type="text" placeholder="6 haneli kod" maxLength={6}
          value={code} onChange={e => setCode(e.target.value)}
        />
        <button className="btn btn-success w-100" disabled={loading}>
          {loading ? <span className="spinner-border spinner-border-sm" /> : 'Doğrula'}
        </button>
      </form>

      {msg && <div className={`alert alert-${msg.type} mt-3 py-2`}>{msg.text}</div>}
    </div>
  )
}

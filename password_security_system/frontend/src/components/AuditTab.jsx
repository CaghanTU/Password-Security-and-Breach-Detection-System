import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

const ACTION_COLORS = {
  LOGIN: 'success', LOGIN_FAILED: 'danger', LOGOUT: 'secondary',
  '2FA_ENABLED': 'info', CREDENTIAL_ADD: 'primary', CREDENTIAL_UPDATE: 'warning',
  CREDENTIAL_DELETE: 'danger', BREACH_CHECK: 'info', EXPORT: 'light',
  AUDIT_CLEARED: 'danger',
}

export default function AuditTab() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Delete panel state
  const [showDelete, setShowDelete] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [deleting, setDeleting]       = useState(false)
  const [deleteMsg, setDeleteMsg]     = useState(null) // {ok, text}
  const [confirmAll, setConfirmAll]   = useState(false)

  const load = useCallback(async (p) => {
    setLoading(true)
    try { setData(await api.getAudit(p)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(page) }, [load, page])

  function changePage(delta) {
    const next = page + delta
    if (next < 1) return
    setPage(next)
  }

  async function handleDelete(all) {
    setDeleting(true); setDeleteMsg(null)
    try {
      const res = await api.deleteAudit(
        all ? '' : dateFrom,
        all ? '' : dateTo,
      )
      setDeleteMsg({ ok: true, text: `${res.deleted} kayıt silindi.` })
      setPage(1)
      load(1)
    } catch (e) {
      setDeleteMsg({ ok: false, text: e.message })
    } finally {
      setDeleting(false)
      setConfirmAll(false)
    }
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="mb-0">Audit Log</h5>
        <button
          className={`btn btn-sm ${showDelete ? 'btn-outline-secondary' : 'btn-outline-danger'}`}
          onClick={() => { setShowDelete(v => !v); setDeleteMsg(null); setConfirmAll(false) }}
        >
          {showDelete ? '✕ İptal' : '🗑 Kayıtları Temizle'}
        </button>
      </div>

      {/* Delete panel */}
      {showDelete && (
        <div className="card p-3 mb-4" style={{ border: '1px solid #dc354555', background: '#1a0d0d' }}>
          <div className="fw-semibold mb-2" style={{ color: '#dc3545' }}>Kayıt Silme</div>

          <div className="row g-2 mb-3">
            <div className="col-sm-6">
              <label className="form-label small text-secondary">Başlangıç tarihi</label>
              <input type="date" className="form-control form-control-sm"
                value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="col-sm-6">
              <label className="form-label small text-secondary">Bitiş tarihi</label>
              <input type="date" className="form-control form-control-sm"
                value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="d-flex gap-2 flex-wrap">
            <button
              className="btn btn-sm btn-danger"
              disabled={deleting || (!dateFrom && !dateTo)}
              onClick={() => handleDelete(false)}
            >
              {deleting ? <span className="spinner-border spinner-border-sm" /> : '🗑 Tarih Aralığını Sil'}
            </button>

            {!confirmAll ? (
              <button className="btn btn-sm btn-outline-danger" onClick={() => setConfirmAll(true)}>
                Tümünü Sil
              </button>
            ) : (
              <>
                <span className="small text-danger align-self-center">Emin misin?</span>
                <button className="btn btn-sm btn-danger" disabled={deleting} onClick={() => handleDelete(true)}>
                  {deleting ? <span className="spinner-border spinner-border-sm" /> : 'Evet, Tümünü Sil'}
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setConfirmAll(false)}>Hayır</button>
              </>
            )}
          </div>

          {deleteMsg && (
            <div className={`alert ${deleteMsg.ok ? 'alert-success' : 'alert-danger'} mt-3 py-2 mb-0`}>
              {deleteMsg.text}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : !data || !data.items.length ? (
        <p className="text-secondary">Henüz kayıt yok.</p>
      ) : (
        <>
          <p className="text-secondary small">Sayfa {data.page} — Toplam {data.total} kayıt</p>
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle">
              <thead>
                <tr>
                  <th>Tarih / Saat</th>
                  <th>Aksiyon</th>
                  <th>IP Adresi</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(e => (
                  <tr key={e.id}>
                    <td className="text-secondary small">{new Date(e.created_at).toLocaleString('tr-TR')}</td>
                    <td>
                      <span className={`badge text-bg-${ACTION_COLORS[e.action] ?? 'secondary'}`}>
                        {e.action}
                      </span>
                    </td>
                    <td className="text-secondary small font-monospace">{e.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex gap-2 mt-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => changePage(-1)} disabled={page <= 1}>
              ← Önceki
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => changePage(1)}
              disabled={data.items.length < 20}>
              Sonraki →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

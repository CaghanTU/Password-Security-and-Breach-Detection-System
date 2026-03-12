import { useState, useRef } from 'react'
import { api } from '../services/api'

export default function ExportTab() {
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)

  async function doExport() {
    setExportLoading(true); setMsg(null)
    try {
      const data = await api.exportVault()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vault_export_${Date.now()}.enc.json`
      a.click()
      URL.revokeObjectURL(url)
      setMsg({ type: 'success', text: 'Vault başarıyla indirildi.' })
    } catch (err) {
      setMsg({ type: 'danger', text: err.message })
    } finally {
      setExportLoading(false)
    }
  }

  async function doImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setMsg({ type: 'warning', text: 'Lütfen bir dosya seçin.' }); return }
    setImportLoading(true); setMsg(null)
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      if (!payload.ciphertext || !payload.iv || !payload.tag) {
        throw new Error('Geçersiz vault dosyası formatı.')
      }
      const result = await api.importVault(payload)
      setMsg({
        type: 'success',
        text: `İçe aktarma tamamlandı: ${result.imported} kayıt eklendi, ${result.skipped} atlandı.${
          result.errors.length ? ' Hatalar: ' + result.errors.slice(0, 3).join('; ') : ''
        }`,
      })
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setMsg({ type: 'danger', text: err.message })
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 540 }}>
      {/* Export */}
      <div className="card p-4 mb-3">
        <h5 className="mb-2">📦 Vault Dışa Aktar</h5>
        <p className="text-secondary small mb-3">
          Tüm vault AES-256-GCM ile şifrelenmiş olarak indirilir.
          Düz metin hiçbir zaman diske yazılmaz.
        </p>
        <button className="btn btn-outline-primary w-100" onClick={doExport} disabled={exportLoading}>
          {exportLoading ? <span className="spinner-border spinner-border-sm" /> : '⬇ İndir (.enc.json)'}
        </button>
      </div>

      {/* Import */}
      <div className="card p-4">
        <h5 className="mb-2">📂 Vault İçe Aktar</h5>
        <p className="text-secondary small mb-3">
          Daha önce dışa aktardığın <code>.enc.json</code> dosyasını yükle.
          Şifreler otomatik çözülür ve hesabına eklenir.
          Tekrar eden kayıtlar atlanır.
        </p>
        <div className="mb-3">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.enc.json"
            className="form-control"
          />
        </div>
        <button className="btn btn-outline-success w-100" onClick={doImport} disabled={importLoading}>
          {importLoading ? <span className="spinner-border spinner-border-sm" /> : '⬆ Yükle ve İçe Aktar'}
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type} mt-3 py-2`}>{msg.text}</div>}
    </div>
  )
}

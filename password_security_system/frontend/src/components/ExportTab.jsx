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
      setMsg({ type: 'success', text: 'Vault downloaded successfully.' })
    } catch (err) {
      setMsg({ type: 'danger', text: err.message })
    } finally {
      setExportLoading(false)
    }
  }

  async function doImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) { setMsg({ type: 'warning', text: 'Please select a file.' }); return }
    setImportLoading(true); setMsg(null)
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      if (!payload.ciphertext || !payload.iv || !payload.tag) {
        throw new Error('Invalid vault file format.')
      }
      const result = await api.importVault(payload)
      setMsg({
        type: 'success',
        text: `Import complete: ${result.imported} credentials added, ${result.skipped} skipped.${
          result.errors.length ? ' Errors: ' + result.errors.slice(0, 3).join('; ') : ''
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
        <h5 className="mb-2">Export Vault</h5>
        <p className="text-secondary small mb-3">
          Your entire vault will be downloaded encrypted with AES-256-GCM.
          Plain text is never written to disk — your data is safe.
        </p>
        <button className="btn btn-outline-primary w-100" onClick={doExport} disabled={exportLoading}>
          {exportLoading ? <span className="spinner-border spinner-border-sm" /> : 'Download (.enc.json)'}
        </button>
      </div>

      {/* Import */}
      <div className="card p-4">
        <h5 className="mb-2">Import Vault</h5>
        <p className="text-secondary small mb-3">
          Upload a previously exported <code>.enc.json</code> file.
          Passwords will be decrypted automatically and added to your account.
          Duplicate entries will be skipped.
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
          {importLoading ? <span className="spinner-border spinner-border-sm" /> : 'Upload & Import'}
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type} mt-3 py-2`}>{msg.text}</div>}
    </div>
  )
}

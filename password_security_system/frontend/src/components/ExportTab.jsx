import { useState, useRef } from 'react'
import { api } from '../services/api'
import {
  Box, Card, CardContent, Typography, Button, Alert, CircularProgress,
  Select, MenuItem, FormControl, InputLabel, Stack,
} from '@mui/material'
import { useAuth } from '../context/auth-context'

const CSV_FORMATS = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'lastpass', label: 'LastPass CSV' },
  { value: 'bitwarden', label: 'Bitwarden JSON' },
  { value: '1password', label: '1Password CSV' },
]

export default function ExportTab() {
  const { invalidateAIInsights } = useAuth()
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [csvMsg, setCsvMsg] = useState(null)
  const [csvFormat, setCsvFormat] = useState('auto')
  const fileRef = useRef(null)
  const csvFileRef = useRef(null)
  const [csvFileName, setCsvFileName] = useState('')

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
      setMsg({ type: 'error', text: err.message })
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
      invalidateAIInsights()
      setMsg({
        type: 'success',
        text: `Import completed: ${result.imported} records added, ${result.skipped} skipped.${
          result.errors?.length ? ' Errors: ' + result.errors.slice(0, 3).join('; ') : ''
        }`,
      })
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setImportLoading(false)
    }
  }

  async function doCSVImport() {
    const file = csvFileRef.current?.files?.[0]
    if (!file) { setCsvMsg({ type: 'warning', text: 'Please select a file.' }); return }
    setCsvLoading(true); setCsvMsg(null)
    try {
      const result = await api.importCSV(file, csvFormat)
      invalidateAIInsights()
      setCsvMsg({
        type: 'success',
        text: `Import completed: ${result.imported} records added, ${result.skipped} skipped.${
          result.errors?.length ? ' Errors: ' + result.errors.slice(0, 3).join('; ') : ''
        }`,
      })
      setCsvFileName('')
      if (csvFileRef.current) csvFileRef.current.value = ''
    } catch (err) {
      setCsvMsg({ type: 'error', text: err.message })
    } finally {
      setCsvLoading(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 560 }}>
      {/* Export */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>📦 Export Vault</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            The entire vault is downloaded encrypted with AES-256-GCM. Plain text is never written to disk.
          </Typography>
          <Button variant="outlined" fullWidth onClick={doExport} disabled={exportLoading}>
            {exportLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            ⬇ Download (.enc.json)
          </Button>
        </CardContent>
      </Card>

      {/* Vault import */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>📂 Import Vault</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Upload a previously exported <code>.enc.json</code> file.
            Passwords are decrypted automatically and added to your account.
          </Typography>
          <Button variant="outlined" component="label" fullWidth sx={{ mb: 1.5 }}>
            Choose File
            <input ref={fileRef} type="file" accept=".json,.enc.json" hidden />
          </Button>
          <Button variant="outlined" color="success" fullWidth onClick={doImport} disabled={importLoading}>
            {importLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            ⬆ Upload and Import
          </Button>
          {msg && <Alert severity={msg.type} sx={{ mt: 2 }}>{msg.text}</Alert>}
        </CardContent>
      </Card>

      {/* CSV/JSON import */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>🔄 Import from Other Managers</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Import passwords from LastPass, Bitwarden, or 1Password formats.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Format</InputLabel>
            <Select value={csvFormat} onChange={e => setCsvFormat(e.target.value)} label="Format">
              {CSV_FORMATS.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="outlined" component="label" fullWidth sx={{ mb: 1.5 }}>
            {csvFileName || 'Choose File (CSV / JSON)'}
            <input
              ref={csvFileRef}
              type="file"
              accept=".csv,.json"
              hidden
              onChange={e => setCsvFileName(e.target.files?.[0]?.name || '')}
            />
          </Button>
          <Button variant="outlined" color="primary" fullWidth onClick={doCSVImport} disabled={csvLoading}>
            {csvLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            ⬆ Import
          </Button>
          {csvMsg && <Alert severity={csvMsg.type} sx={{ mt: 2 }}>{csvMsg.text}</Alert>}
        </CardContent>
      </Card>
    </Box>
  )
}

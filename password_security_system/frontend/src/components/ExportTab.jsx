import { useState, useRef } from 'react'
import { api } from '../services/api'
import {
  Box, Card, CardContent, Typography, Button, Alert, CircularProgress,
  Select, MenuItem, FormControl, InputLabel, Stack,
} from '@mui/material'

const CSV_FORMATS = [
  { value: 'auto', label: 'Otomatik Algıla' },
  { value: 'lastpass', label: 'LastPass CSV' },
  { value: 'bitwarden', label: 'Bitwarden JSON' },
  { value: '1password', label: '1Password CSV' },
]

export default function ExportTab() {
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
      setMsg({ type: 'success', text: 'Vault başarıyla indirildi.' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
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
          result.errors?.length ? ' Hatalar: ' + result.errors.slice(0, 3).join('; ') : ''
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
    if (!file) { setCsvMsg({ type: 'warning', text: 'Lütfen bir dosya seçin.' }); return }
    setCsvLoading(true); setCsvMsg(null)
    try {
      const result = await api.importCSV(file, csvFormat)
      setCsvMsg({
        type: 'success',
        text: `İçe aktarma tamamlandı: ${result.imported} kayıt eklendi, ${result.skipped} atlandı.${
          result.errors?.length ? ' Hatalar: ' + result.errors.slice(0, 3).join('; ') : ''
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
          <Typography variant="h6" gutterBottom>📦 Vault Dışa Aktar</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Tüm vault AES-256-GCM ile şifrelenmiş olarak indirilir. Düz metin hiçbir zaman diske yazılmaz.
          </Typography>
          <Button variant="outlined" fullWidth onClick={doExport} disabled={exportLoading}>
            {exportLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            ⬇ İndir (.enc.json)
          </Button>
        </CardContent>
      </Card>

      {/* Vault import */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>📂 Vault İçe Aktar</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Daha önce dışa aktardığın <code>.enc.json</code> dosyasını yükle.
            Şifreler otomatik çözülür ve hesabına eklenir.
          </Typography>
          <Button variant="outlined" component="label" fullWidth sx={{ mb: 1.5 }}>
            Dosya Seç
            <input ref={fileRef} type="file" accept=".json,.enc.json" hidden />
          </Button>
          <Button variant="outlined" color="success" fullWidth onClick={doImport} disabled={importLoading}>
            {importLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            ⬆ Yükle ve İçe Aktar
          </Button>
          {msg && <Alert severity={msg.type} sx={{ mt: 2 }}>{msg.text}</Alert>}
        </CardContent>
      </Card>

      {/* CSV/JSON import */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>🔄 Diğer Yöneticilerden İçe Aktar</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            LastPass, Bitwarden veya 1Password formatlarından şifreleri aktar.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Format</InputLabel>
            <Select value={csvFormat} onChange={e => setCsvFormat(e.target.value)} label="Format">
              {CSV_FORMATS.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="outlined" component="label" fullWidth sx={{ mb: 1.5 }}>
            {csvFileName || 'Dosya Seç (CSV / JSON)'}
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
            ⬆ İçe Aktar
          </Button>
          {csvMsg && <Alert severity={csvMsg.type} sx={{ mt: 2 }}>{csvMsg.text}</Alert>}
        </CardContent>
      </Card>
    </Box>
  )
}

import { useState } from 'react'
import { api } from '../services/api'
import {
  Box, Card, CardContent, Typography, Button, TextField,
  Divider, Alert, CircularProgress,
} from '@mui/material'

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
      setMsg({ type: 'error', text: err.message })
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
      setMsg({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card sx={{ maxWidth: 420, textAlign: 'center' }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>İki Faktörlü Kimlik Doğrulama</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          QR kodu Google Authenticator veya Authy ile tarayın.
        </Typography>

        <Button variant="contained" onClick={setup} disabled={loading} sx={{ mb: 3 }}>
          {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          QR Kod Oluştur
        </Button>

        {qr && (
          <Box mb={3}>
            <Box
              component="img"
              src={qr}
              alt="2FA QR Code"
              sx={{ maxWidth: 220, width: '100%', borderRadius: 1, mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              Manuel giriş için secret:{' '}
              <Box component="code" sx={{ color: 'info.main' }}>{secret}</Box>
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" mb={2}>Kodu Doğrula</Typography>
        <Box component="form" onSubmit={verify}>
          <TextField
            fullWidth
            placeholder="6 haneli kod"
            inputProps={{ maxLength: 6, style: { textAlign: 'center' } }}
            value={code}
            onChange={e => setCode(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Button type="submit" variant="contained" color="success" fullWidth disabled={loading}>
            {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            Doğrula
          </Button>
        </Box>

        {msg && <Alert severity={msg.type} sx={{ mt: 2 }}>{msg.text}</Alert>}
      </CardContent>
    </Card>
  )
}

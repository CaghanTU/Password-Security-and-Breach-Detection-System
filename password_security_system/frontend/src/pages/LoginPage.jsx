import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import {
  Box, Paper, Typography, Tabs, Tab, TextField,
  Button, Alert, CircularProgress,
} from '@mui/material'

export default function LoginPage() {
  const { login } = useAuth()
  const [tab, setTab] = useState(0)
  const [form, setForm] = useState({ username: '', password: '', totp: '' })
  const [qrData, setQrData] = useState(null) // { qr_image, secret, username, password }
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.username, form.password, form.totp || undefined)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const data = await api.register(form.username, form.password)
      setQrData({ qr_image: data.qr_image, secret: data.secret, username: form.username, password: form.password })
      setTotpCode('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyAndLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(qrData.username, qrData.password, totpCode)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (qrData) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Paper elevation={6} sx={{ width: 440, p: 4, textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={700} color="primary" mb={1}>
            2FA Kurulumu
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            QR kodu Google Authenticator veya Authy ile tara, ardından oluşturulan 6 haneli kodu girerek devam et.
          </Typography>
          <Box
            component="img"
            src={qrData.qr_image}
            alt="2FA QR Kodu"
            sx={{ width: 200, height: 200, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
          />
          <Typography variant="caption" display="block" color="text.secondary" mb={3} sx={{ wordBreak: 'break-all' }}>
            Manuel anahtar: {qrData.secret}
          </Typography>
          <Box component="form" onSubmit={handleVerifyAndLogin}>
            <TextField
              fullWidth
              label="6 haneli kod"
              inputProps={{ maxLength: 6 }}
              autoComplete="one-time-code"
              value={totpCode}
              onChange={e => setTotpCode(e.target.value)}
              sx={{ mb: 2 }}
            />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || totpCode.length < 6}
              sx={{ mt: 1 }}
            >
              {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
              Doğrula ve Giriş Yap
            </Button>
          </Box>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Paper elevation={6} sx={{ width: 420, p: 4 }}>
        <Typography variant="h5" fontWeight={700} textAlign="center" color="primary" mb={3}>
          🔐 Password Security System
        </Typography>

        <Tabs value={tab} onChange={(_, v) => { setTab(v); setError('') }} variant="fullWidth" sx={{ mb: 3 }}>
          <Tab label="Giriş" />
          <Tab label="Kayıt Ol" />
        </Tabs>

        {tab === 0 && (
          <Box component="form" onSubmit={handleLogin}>
            <TextField fullWidth label="Kullanıcı Adı" required autoComplete="username"
              value={form.username} onChange={set('username')} sx={{ mb: 2 }} />
            <TextField fullWidth label="Master Şifre" type="password" required autoComplete="current-password"
              value={form.password} onChange={set('password')} sx={{ mb: 2 }} />
            <TextField fullWidth label="2FA Kodu" inputProps={{ maxLength: 6 }}
              autoComplete="one-time-code"
              value={form.totp} onChange={set('totp')} sx={{ mb: 2 }} />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Button type="submit" variant="contained" fullWidth disabled={loading} sx={{ mt: 1 }}>
              {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
              Giriş Yap
            </Button>
          </Box>
        )}

        {tab === 1 && (
          <Box component="form" onSubmit={handleRegister}>
            <TextField fullWidth label="Kullanıcı Adı" required autoComplete="username"
              value={form.username} onChange={set('username')} sx={{ mb: 2 }} />
            <TextField fullWidth label="Master Şifre" type="password" required autoComplete="new-password"
              value={form.password} onChange={set('password')} sx={{ mb: 2 }} />
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Button type="submit" variant="contained" color="success" fullWidth disabled={loading} sx={{ mt: 1 }}>
              {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
              Hesap Oluştur
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  )
}

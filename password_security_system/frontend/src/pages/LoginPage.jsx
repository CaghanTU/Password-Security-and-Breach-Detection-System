import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import {
  Box, Paper, Typography, Tabs, Tab, TextField,
  FormControlLabel, Checkbox, Button, Alert, CircularProgress,
} from '@mui/material'

export default function LoginPage() {
  const { login } = useAuth()
  const [tab, setTab] = useState(0)
  const [form, setForm] = useState({ username: '', password: '', totp: '' })
  const [show2fa, setShow2fa] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.username, form.password, show2fa ? form.totp : undefined)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError(''); setSuccess(''); setLoading(true)
    try {
      await api.register(form.username, form.password)
      setSuccess('Kayıt başarılı! Giriş yapabilirsiniz.')
      setTab(0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <Paper elevation={6} sx={{ width: 420, p: 4 }}>
        <Typography variant="h5" fontWeight={700} textAlign="center" color="primary" mb={3}>
          🔐 Password Security System
        </Typography>

        <Tabs value={tab} onChange={(_, v) => { setTab(v); setError(''); setSuccess('') }} variant="fullWidth" sx={{ mb: 3 }}>
          <Tab label="Giriş" />
          <Tab label="Kayıt Ol" />
        </Tabs>

        {tab === 0 && (
          <Box component="form" onSubmit={handleLogin}>
            <TextField fullWidth label="Kullanıcı Adı" required autoComplete="username"
              value={form.username} onChange={set('username')} sx={{ mb: 2 }} />
            <TextField fullWidth label="Master Şifre" type="password" required autoComplete="current-password"
              value={form.password} onChange={set('password')} sx={{ mb: 2 }} />
            <FormControlLabel
              control={<Checkbox checked={show2fa} onChange={e => setShow2fa(e.target.checked)} />}
              label="2FA etkin (kodu gir)"
              sx={{ mb: 1 }}
            />
            {show2fa && (
              <TextField fullWidth placeholder="6 haneli kod" inputProps={{ maxLength: 6 }}
                autoComplete="one-time-code"
                value={form.totp} onChange={set('totp')} sx={{ mb: 2 }} />
            )}
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
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
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

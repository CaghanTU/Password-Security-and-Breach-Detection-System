import { useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid, Paper, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import { useAuth } from '../context/auth-context'
import { api } from '../services/api'

function AuthShell({ children, title, caption }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 3 }}>
      <Paper sx={{ width: 'min(1080px, 100%)', overflow: 'hidden', borderRadius: 7 }}>
        <Grid container>
          <Grid
            size={{ xs: 12, md: 5 }}
            sx={{
              p: { xs: 3, md: 4 },
              background: 'linear-gradient(155deg, rgba(16, 34, 38, 0.98) 0%, rgba(10, 20, 27, 0.96) 100%)',
              borderRight: { md: '1px solid rgba(255,255,255,0.06)' },
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 3,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: 'rgba(99, 216, 204, 0.12)',
                    color: 'primary.light',
                  }}
                >
                  <ShieldOutlinedIcon fontSize="small" />
                </Box>
                <Box>
                  <Typography variant="overline" sx={{ color: 'primary.light', letterSpacing: '0.12em' }}>
                    Password Security System
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Vault console
                  </Typography>
                </Box>
              </Stack>

              <Box>
                <Typography variant="h4" sx={{ mb: 1.25 }}>
                  Store passwords, track breaches, reduce risk.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                  This console brings together a password vault, breach tracking, 2FA, and explainable risk scoring in one workspace.
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip icon={<KeyRoundedIcon />} label="Password vault" variant="outlined" />
                <Chip icon={<InsightsRoundedIcon />} label="Risk score" variant="outlined" />
                <Chip icon={<VerifiedUserRoundedIcon />} label="2FA + recovery" variant="outlined" />
              </Stack>

              <Divider />

              <Box sx={{ display: 'grid', gap: 1.25 }}>
                {[
                  'Action center for breached records',
                  'Safe recovery with recovery codes',
                  'PDF reports and health trend views',
                ].map(item => (
                  <Paper
                    key={item}
                    sx={{
                      p: 1.5,
                      borderRadius: 4,
                      bgcolor: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Typography variant="body2">{item}</Typography>
                  </Paper>
                ))}
              </Box>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }} sx={{ p: { xs: 3, md: 4 } }}>
            <Typography variant="overline" sx={{ color: 'secondary.light', letterSpacing: '0.12em' }}>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.5 }}>
              {caption}
            </Typography>
            <Box sx={{ mt: 3 }}>
              {children}
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}

export default function LoginPage() {
  const { login } = useAuth()
  const [tab, setTab] = useState(0)
  const [loginMethod, setLoginMethod] = useState('totp')
  const [form, setForm] = useState({ username: '', password: '', totp: '', recovery: '' })
  const [qrData, setQrData] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = key => event => setForm(current => ({ ...current, [key]: event.target.value }))

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(
        form.username,
        form.password,
        loginMethod === 'totp' ? form.totp || undefined : undefined,
        loginMethod === 'recovery' ? form.recovery || undefined : undefined,
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.register(form.username, form.password)
      setQrData({
        qr_image: data.qr_image,
        secret: data.secret,
        username: form.username,
        password: form.password,
      })
      setTotpCode('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyAndLogin(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
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
      <AuthShell title="Setup" caption="Pair your authenticator app">
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
            Scan the QR code with Google Authenticator or Authy. Then enter the 6-digit code generated by the app to verify your account.
          </Typography>

          <Paper sx={{ p: 3, borderRadius: 5, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)' }}>
            <Box
              component="img"
              src={qrData.qr_image}
              alt="2FA QR Code"
              sx={{ width: 220, height: 220, borderRadius: 4, border: '1px solid', borderColor: 'divider', mb: 2 }}
            />
            <Typography variant="caption" display="block" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
              Manual key: {qrData.secret}
            </Typography>
          </Paper>

          <Box component="form" onSubmit={handleVerifyAndLogin}>
            <TextField
              fullWidth
              label="6-digit verification code"
              inputProps={{ maxLength: 6 }}
              autoComplete="one-time-code"
              value={totpCode}
              onChange={event => setTotpCode(event.target.value)}
            />
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            <Button type="submit" variant="contained" fullWidth disabled={loading || totpCode.length < 6} sx={{ mt: 2 }}>
              {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
              Verify and Continue
            </Button>
          </Box>
        </Stack>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Sign In" caption="Verify your account to access the vault">
      <Tabs value={tab} onChange={(_, nextValue) => { setTab(nextValue); setError('') }} sx={{ mb: 3 }}>
        <Tab label="Sign In" />
        <Tab label="Create Account" />
      </Tabs>

      {tab === 0 && (
        <Box component="form" onSubmit={handleLogin}>
          <TextField
            fullWidth
            label="Username"
            required
            autoComplete="username"
            value={form.username}
            onChange={set('username')}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Master password"
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={set('password')}
            sx={{ mb: 2 }}
          />

          <Tabs value={loginMethod} onChange={(_, nextValue) => { setLoginMethod(nextValue); setError('') }} sx={{ mb: 2 }}>
            <Tab value="totp" label="Authenticator" />
            <Tab value="recovery" label="Recovery code" />
          </Tabs>

          {loginMethod === 'totp' ? (
            <TextField
              fullWidth
              label="2FA code"
              inputProps={{ maxLength: 6 }}
              autoComplete="one-time-code"
              value={form.totp}
              onChange={set('totp')}
              sx={{ mb: 2 }}
            />
          ) : (
            <TextField
              fullWidth
              label="Recovery code"
              placeholder="ABCD-EFGH"
              value={form.recovery}
              onChange={set('recovery')}
              sx={{ mb: 2 }}
            />
          )}

          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            {loginMethod === 'totp'
              ? 'Enter the one-time code from your authenticator app.'
              : 'If you do not have authenticator access, continue with a recovery code you saved earlier.'}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Button type="submit" variant="contained" fullWidth disabled={loading}>
            {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Sign In
          </Button>
        </Box>
      )}

      {tab === 1 && (
        <Box component="form" onSubmit={handleRegister}>
          <TextField
            fullWidth
            label="Username"
            required
            autoComplete="username"
            value={form.username}
            onChange={set('username')}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Master password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            sx={{ mb: 2 }}
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Mandatory 2FA setup starts immediately after account creation.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Button type="submit" variant="contained" color="success" fullWidth disabled={loading}>
            {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Create Account
          </Button>
        </Box>
      )}
    </AuthShell>
  )
}

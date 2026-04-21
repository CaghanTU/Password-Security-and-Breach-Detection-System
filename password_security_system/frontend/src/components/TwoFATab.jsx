import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Grid, Stack, TextField, Typography,
} from '@mui/material'

function downloadRecoveryCodes(codes) {
  const blob = new Blob([codes.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'recovery_codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

export default function TwoFATab({ navigationTarget }) {
  const [qr, setQr] = useState(null)
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [recoverySummary, setRecoverySummary] = useState(null)
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const totpSectionRef = useRef(null)
  const recoverySectionRef = useRef(null)

  const loadRecoverySummary = useCallback(async () => {
    try {
      setRecoverySummary(await api.getRecoveryCodesSummary())
    } catch {
      setRecoverySummary(null)
    }
  }, [])

  useEffect(() => {
    loadRecoverySummary()
  }, [loadRecoverySummary])

  useEffect(() => {
    if (navigationTarget?.tabId !== 'twofa') return
    const targetRef = navigationTarget.section === 'recovery' ? recoverySectionRef : totpSectionRef
    const node = targetRef.current
    if (!node) return
    const timer = window.setTimeout(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [navigationTarget])

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
      setMsg({ type: 'success', text: 'Code verified. 2FA is now active.' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function regenerateRecoveryCodes() {
    setRecoveryLoading(true)
    setMsg(null)
    try {
      const data = await api.regenerateRecoveryCodes()
      setRecoveryCodes(data.codes)
      setMsg({ type: 'success', text: 'A new set of recovery codes was created. Store them somewhere safe.' })
      await loadRecoverySummary()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setRecoveryLoading(false)
    }
  }

  const severity = !recoverySummary?.has_codes
    ? 'error'
    : recoverySummary.remaining <= 2
      ? 'warning'
      : 'success'

  return (
    <Grid container spacing={2} sx={{ maxWidth: 980 }}>
      <Grid size={{ xs: 12, md: 5 }} ref={totpSectionRef}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom>Two-Factor Authentication</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Scan the QR code with Google Authenticator or Authy to protect your account with a second factor.
            </Typography>

            <Button variant="contained" onClick={setup} disabled={loading} sx={{ mb: 3 }}>
              {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
              Generate QR Code
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
                  Secret for manual entry:{' '}
                  <Box component="code" sx={{ color: 'info.main' }}>{secret}</Box>
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" mb={2}>Verify Code</Typography>
            <Box component="form" onSubmit={verify}>
              <TextField
                fullWidth
                placeholder="6-digit code"
                inputProps={{ maxLength: 6, style: { textAlign: 'center' } }}
                value={code}
                onChange={e => setCode(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button type="submit" variant="contained" color="success" fullWidth disabled={loading}>
                {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                Verify
              </Button>
            </Box>

            {msg && <Alert severity={msg.type} sx={{ mt: 2 }}>{msg.text}</Alert>}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 7 }} ref={recoverySectionRef}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
              <Box>
                <Typography variant="h6">Recovery Codes</Typography>
                <Typography variant="body2" color="text.secondary">
                  If you lose access to your authenticator app, you can use these to get back into your account.
                </Typography>
              </Box>
              {recoverySummary && (
                <Chip
                  color={severity}
                  label={recoverySummary.has_codes ? `${recoverySummary.remaining} codes left` : 'No codes'}
                />
              )}
            </Stack>

            {recoverySummary && (
              <Alert severity={severity} sx={{ mb: 2 }}>
                {recoverySummary.has_codes
                  ? `${recoverySummary.remaining} of ${recoverySummary.total} total codes are still usable.`
                  : 'No recovery codes have been generated yet. It is a good idea to create at least one set.'}
              </Alert>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" mb={3}>
              <Button
                variant="contained"
                color="warning"
                onClick={regenerateRecoveryCodes}
                disabled={recoveryLoading}
              >
                {recoveryLoading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                Generate / Refresh Recovery Codes
              </Button>
              <Button variant="outlined" onClick={loadRecoverySummary} disabled={recoveryLoading}>
                Refresh Status
              </Button>
            </Stack>

            {recoveryCodes.length > 0 && (
              <Box>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  These codes are shown in full only now. Copy them and store them somewhere safe.
                </Alert>
                <Grid container spacing={1} mb={2}>
                  {recoveryCodes.map(codeValue => (
                    <Grid key={codeValue} size={{ xs: 12, sm: 6 }}>
                      <Box
                        sx={{
                          px: 2,
                          py: 1.25,
                          borderRadius: 1,
                          bgcolor: 'background.default',
                          border: '1px solid',
                          borderColor: 'divider',
                          fontFamily: 'monospace',
                          letterSpacing: '0.08em',
                          textAlign: 'center',
                        }}
                      >
                        {codeValue}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button variant="outlined" onClick={() => navigator.clipboard.writeText(recoveryCodes.join('\n'))}>
                    Copy All
                  </Button>
                  <Button variant="outlined" onClick={() => downloadRecoveryCodes(recoveryCodes)}>
                    Download as TXT
                  </Button>
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

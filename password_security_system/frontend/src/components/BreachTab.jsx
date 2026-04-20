import { useState } from 'react'
import { api } from '../services/api'
import {
  Box, Card, CardContent, Typography, TextField, Button, Alert,
  CircularProgress, Chip, Stack, Grid, Paper,
} from '@mui/material'

const DATA_CLASS_META = {
  'Passwords':             { color: '#dc3545', icon: 'PW' },
  'Email addresses':       { color: '#fd7e14', icon: 'MAIL' },
  'Usernames':             { color: '#ffc107', icon: 'ID' },
  'IP addresses':          { color: '#6f42c1', icon: 'IP' },
  'Phone numbers':         { color: '#0dcaf0', icon: 'TEL' },
  'Dates of birth':        { color: '#20c997', icon: 'DOB' },
  'Names':                 { color: '#6c757d', icon: 'AD' },
  'Geographic locations':  { color: '#198754', icon: 'GEO' },
  'Social media profiles': { color: '#0d6efd', icon: 'SOS' },
  'Credit cards':          { color: '#dc3545', icon: 'CARD' },
}

function DataTag({ label }) {
  const meta = DATA_CLASS_META[label] || { color: '#6c757d', icon: 'VERI' }
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        mr: 0.5, mb: 0.5,
        px: 1, py: 0.25,
        borderRadius: 1,
        fontSize: '0.75rem',
        fontWeight: 500,
        background: meta.color + '22',
        color: meta.color,
        border: `1px solid ${meta.color}55`,
      }}
    >
      {meta.icon} {label}
    </Box>
  )
}

function BreachCard({ b, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)

  const dateStr = b.breach_date
    ? new Date(b.breach_date + 'T00:00:00').toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' })
    : 'Tarih bilinmiyor'

  const logoUrl = b.logo_path || null
  const plainDesc = b.description
    ? b.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : null

  return (
    <Paper
      variant="outlined"
      sx={{ mb: 2, overflow: 'hidden' }}
    >
      {/* Header */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, cursor: 'pointer' }}
        onClick={() => setOpen(v => !v)}
      >
        {/* Logo */}
        <Box sx={{ width: 48, height: 48, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {logoUrl
            ? <Box component="img" src={logoUrl} alt={b.title} sx={{ width: 40, height: 40, objectFit: 'contain' }}
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = 'B'; }} />
            : <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>B</Typography>
          }
        </Box>

        {/* Name + date + badges */}
        <Box flexGrow={1} minWidth={0}>
          <Typography fontWeight={700}>{b.title || b.name}</Typography>
          <Stack direction="row" flexWrap="wrap" alignItems="center" spacing={0.5} mt={0.5}>
            <Typography variant="caption" color="text.secondary">{dateStr}</Typography>
            {b.pwn_count > 0 && (
              <Box component="span" sx={{ px: 0.75, py: 0.25, borderRadius: 1, fontSize: '0.75rem', background: '#dc354522', color: '#dc3545', border: '1px solid #dc354555' }}>
                {b.pwn_count.toLocaleString()} hesap
              </Box>
            )}
            {b.is_sensitive && (
              <Box component="span" sx={{ px: 0.75, py: 0.25, borderRadius: 1, fontSize: '0.75rem', background: '#6f42c122', color: '#c070ff', border: '1px solid #6f42c155' }}>
                hassas
              </Box>
            )}
            {b.is_verified === false && (
              <Box component="span" sx={{ px: 0.75, py: 0.25, borderRadius: 1, fontSize: '0.75rem', color: 'text.secondary', border: '1px solid', borderColor: 'divider' }}>
                doğrulanmamış
              </Box>
            )}
          </Stack>
        </Box>

        {/* Data tags (desktop) */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 260 }}>
          {b.data_classes.slice(0, 4).map(dc => <DataTag key={dc} label={dc} />)}
          {b.data_classes.length > 4 && (
            <Typography variant="caption" color="text.secondary">+{b.data_classes.length - 4} daha</Typography>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{open ? 'Kapat' : 'Aç'}</Typography>
      </Box>

      {/* Expanded detail */}
      {open && (
        <Box sx={{ px: 3, pb: 3, borderTop: 1, borderColor: 'divider' }}>
          <Box mt={2}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: '0.05em' }}>
              SIZDIRILAN VERİLER
            </Typography>
            <Box mt={0.5}>{b.data_classes.map(dc => <DataTag key={dc} label={dc} />)}</Box>
          </Box>

          {plainDesc && (
            <Box mt={2}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ letterSpacing: '0.05em' }}>
                OLAY AÇIKLAMASI
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5} sx={{ lineHeight: 1.6 }}>{plainDesc}</Typography>
            </Box>
          )}

          <Stack direction="row" flexWrap="wrap" spacing={2} mt={2}>
            {b.domain && <Typography variant="caption" color="text.secondary">Alan adı: {b.domain}</Typography>}
            {b.breach_date && <Typography variant="caption" color="text.secondary">Tarih: {dateStr}</Typography>}
            {b.pwn_count > 0 && <Typography variant="caption" color="text.secondary">{b.pwn_count.toLocaleString()} hesap etkilendi</Typography>}
          </Stack>
        </Box>
      )}
    </Paper>
  )
}

function BreachHistory({ result }) {
  if (!result || !result.email) {
    return <Alert severity="warning" sx={{ mt: 3 }}>Invalid response from server</Alert>
  }

  const { email, breaches } = result

  if (!breaches || !Array.isArray(breaches) || breaches.length === 0) {
    return (
      <Alert severity="success" sx={{ mt: 3 }}>
        <strong>{email}</strong> için bilinen ihlallerde kayıt bulunamadı.
      </Alert>
    )
  }

  const sorted = [...breaches].sort((a, b) => (b.breach_date || '').localeCompare(a.breach_date || ''))

  return (
    <Box mt={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" mb={0}>İhlal Geçmişin</Typography>
          <Typography variant="caption" color="text.secondary">{email} · {breaches.length} ihlal tespit edildi</Typography>
        </Box>
        <Chip label={`${breaches.length} ihlal`} color="error" />
      </Box>

      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', px: 2, pb: 1, gap: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ width: 48, flexShrink: 0 }} />
        <Typography variant="caption" fontWeight={700} color="text.secondary" flexGrow={1}>İhlal</Typography>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ width: 260, textAlign: 'right' }}>Sızdırılan Veriler</Typography>
        <Box sx={{ width: 24 }} />
      </Box>

      <Box mt={1}>
        {sorted.map((b, i) => <BreachCard key={b.name} b={b} defaultOpen={i === 0} />)}
      </Box>
    </Box>
  )
}

export default function BreachTab() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailResult, setEmailResult] = useState(null)
  const [pwResult, setPwResult] = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [pwError, setPwError] = useState('')

  async function checkEmail(e) {
    e.preventDefault()
    setEmailError(''); setEmailResult(null); setEmailLoading(true)
    try { setEmailResult(await api.checkEmail(email)) }
    catch (err) { setEmailError(err.message) }
    finally { setEmailLoading(false) }
  }

  async function checkPassword(e) {
    e.preventDefault()
    setPwError(''); setPwResult(null); setPwLoading(true)
    try { setPwResult(await api.checkPassword(password)) }
    catch (err) { setPwError(err.message) }
    finally { setPwLoading(false) }
  }

  return (
    <Box>
      <Grid container spacing={2} mb={1}>
        {/* Email */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>E-posta ihlal kontrolü</Typography>
              <Stack direction="row" spacing={1} component="form" onSubmit={checkEmail}>
                <TextField fullWidth type="email" required placeholder="ornek@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} size="small" />
                <Button variant="contained" color="warning" type="submit" disabled={emailLoading} sx={{ flexShrink: 0 }}>
                  {emailLoading ? <CircularProgress size={18} /> : 'Tara'}
                </Button>
              </Stack>
              {emailError && <Alert severity="error" sx={{ mt: 2 }}>{emailError}</Alert>}
            </CardContent>
          </Card>
        </Grid>

        {/* Password */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Şifre kontrolü{' '}
                <Typography component="span" variant="body2" color="text.secondary">(k-anonimlik)</Typography>
              </Typography>
              <Stack direction="row" spacing={1} component="form" onSubmit={checkPassword}>
                <TextField fullWidth type="password" required placeholder="Şifrenizi girin"
                  value={password} onChange={e => setPassword(e.target.value)} size="small" />
                <Button variant="contained" color="warning" type="submit" disabled={pwLoading} sx={{ flexShrink: 0 }}>
                  {pwLoading ? <CircularProgress size={18} /> : 'Tara'}
                </Button>
              </Stack>
              {pwError && <Alert severity="error" sx={{ mt: 2 }}>{pwError}</Alert>}
              {pwResult && (
                <Alert severity={pwResult.pwned ? 'error' : 'success'} sx={{ mt: 2 }}>
                  {pwResult.pwned
                    ? <>Bu şifre <strong>{pwResult.count.toLocaleString()}</strong> kez ihlal edilmiş.</>
                    : 'Bilinen ihlallerde bu şifre bulunamadı.'}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {emailResult && <BreachHistory result={emailResult} />}
    </Box>
  )
}

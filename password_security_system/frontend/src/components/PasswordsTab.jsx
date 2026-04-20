import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../services/api'
import {
  Box, Card, CardContent, Chip, Typography, IconButton, Button,
  Select, MenuItem, FormControl, InputLabel, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  InputAdornment, Alert, Stack, Grid, Checkbox, LinearProgress,
  Divider, Collapse, List, ListItem, ListItemText,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import HistoryIcon from '@mui/icons-material/History'
import QrCodeIcon from '@mui/icons-material/QrCode'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'

const CATEGORIES = ['', 'email', 'banking', 'social', 'work', 'other']
const CAT_LABELS  = { '': 'Tümü', email: 'E-posta', banking: 'Bankacılık', social: 'Sosyal', work: 'İş', other: 'Diğer' }
const STRENGTH_COLOR = { weak: 'error', medium: 'warning', strong: 'success' }
const STRENGTH_TEXT = { weak: 'zayıf', medium: 'orta', strong: 'güçlü' }

function StrengthBadge({ label, verbose = false }) {
  const text = STRENGTH_TEXT[label] ?? label
  return (
    <Chip
      label={verbose ? `karmaşıklık: ${text}` : text}
      size="small"
      color={STRENGTH_COLOR[label] ?? 'default'}
    />
  )
}

function SecurityStatusChip({ cred }) {
  const critical = cred.is_breached || cred.email_breached || cred.breach_date_status === 'not_rotated'
  const warning = cred.is_stale
  if (critical) return <Chip label="genel risk: yüksek" size="small" color="error" />
  if (warning) return <Chip label="genel risk: orta" size="small" color="warning" />
  return <Chip label="genel risk: düşük" size="small" color="success" />
}

function TOTPPanel({ credId }) {
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState(null)    // { code, valid_seconds }
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const timerRef = useRef(null)

  // Refresh code every second
  useEffect(() => {
    if (!code) return
    timerRef.current = setInterval(async () => {
      try {
        const fresh = await api.getTOTPCode(credId)
        setCode(fresh)
      } catch {
        return
      }
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [code, credId])

  async function handleSave() {
    if (!secret.trim()) return
    setLoading(true); setErr('')
    try {
      const res = await api.setTOTP(credId, secret.trim())
      setCode(res)
      setSecret('')
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLoad() {
    setLoading(true); setErr('')
    try {
      const res = await api.getTOTPCode(credId)
      setCode(res)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await api.removeTOTP(credId)
      setCode(null)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (code) {
    const pct = (code.valid_seconds / 30) * 100
    return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <Typography variant="h5" sx={{ fontFamily: 'monospace', letterSpacing: 4 }}>
            {code.code}
          </Typography>
          <IconButton size="small" onClick={() => navigator.clipboard.writeText(code.code)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" color="text.secondary">{code.valid_seconds}s</Typography>
          <Button size="small" color="error" onClick={handleRemove} disabled={loading}>Kaldır</Button>
        </Stack>
        <LinearProgress variant="determinate" value={pct} color={pct > 33 ? 'success' : 'error'} sx={{ height: 4, borderRadius: 2 }} />
        {err && <Alert severity="error" sx={{ mt: 1 }}>{err}</Alert>}
      </Box>
    )
  }

  // Check if there's an existing secret
  return (
    <Box>
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" onClick={handleLoad} disabled={loading}>
          {loading ? <CircularProgress size={14} /> : 'Kodu Göster'}
        </Button>
        <TextField
          size="small"
          label="TOTP setup key"
          placeholder="Uygulamanın verdiği secret key"
          helperText="6 haneli anlık kodu değil, hesabın 2FA kurulumunda verilen setup key veya manual entry key bilgisini girin."
          value={secret}
          onChange={e => setSecret(e.target.value)}
          sx={{ flex: 1 }}
        />
        <Button size="small" variant="contained" onClick={handleSave} disabled={loading || !secret.trim()}>Kaydet</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mt: 1 }}>{err}</Alert>}
    </Box>
  )
}

function HistoryPanel({ credId }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getPasswordHistory(credId)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [credId])

  if (loading) return <CircularProgress size={16} />
  if (!history || history.length === 0) return <Typography variant="caption" color="text.secondary">Geçmiş yok.</Typography>

  return (
    <List dense disablePadding>
      {history.map((h, i) => (
        <ListItem key={h.id} disableGutters>
          <ListItemText
            primary={`#${i + 1} — ${new Date(h.archived_at).toLocaleString('tr-TR')}`}
            primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
          />
        </ListItem>
      ))}
    </List>
  )
}

function CredentialRow({ cred, expanded, highlighted, onToggleExpanded, onEdit, onDelete, selected, onSelect }) {
  const [show, setShow] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showTOTP, setShowTOTP] = useState(false)

  return (
    <Card
      id={`cred-row-${cred.id}`}
      sx={{
        mb: 1.5,
        outline: selected || highlighted ? '2px solid' : 'none',
        outlineColor: highlighted ? 'warning.main' : 'primary.main',
        transition: 'outline-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: highlighted ? '0 0 0 3px rgba(255,167,38,0.15)' : 'none',
        overflow: 'hidden',
        background: expanded
          ? 'linear-gradient(180deg, rgba(14, 23, 31, 0.98) 0%, rgba(10, 17, 22, 0.98) 100%)'
          : 'linear-gradient(180deg, rgba(12, 20, 27, 0.96) 0%, rgba(10, 17, 22, 0.96) 100%)',
      }}
    >
      <Box
        sx={{ p: 2.25, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' }, gap: 2, cursor: 'pointer' }}
        onClick={() => onToggleExpanded(cred.id)}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Checkbox size="small" checked={selected} onClick={e => e.stopPropagation()} onChange={e => onSelect(cred.id, e.target.checked)} />
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1" fontWeight={700}>{cred.site_name}</Typography>
              <Chip label={CAT_LABELS[cred.category] ?? cred.category} size="small" variant="outlined" />
              {cred.is_stale && <Chip label="Eski kayıt" size="small" color="warning" />}
              {cred.is_breached && <Chip label={`Şifre ihlali${cred.breach_count > 0 ? ` ${cred.breach_count.toLocaleString()}x` : ''}`} size="small" color="error" />}
              {cred.email_breached && <Chip label={`E-posta ihlali ${cred.email_breach_count}`} size="small" color="error" />}
              {cred.breach_date_status === 'not_rotated' && <Chip label="İhlal sonrası güncellenmedi" size="small" color="error" />}
              {cred.breach_date_status === 'changed_after' && <Chip label="İhlal sonrası güncellendi" size="small" color="success" />}
              {cred.breach_date_status === 'investigate' && <Chip label="Takipte" size="small" color="warning" />}
              {cred.totp_secret && <Chip label="TOTP aktif" size="small" color="info" icon={<QrCodeIcon />} />}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.9 }}>
              {cred.site_username}
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="flex-end"
          flexWrap="wrap"
          onClick={e => e.stopPropagation()}
        >
          <SecurityStatusChip cred={cred} />
          <StrengthBadge label={cred.strength_label} verbose />
          <Button
            size="small"
            variant={expanded ? 'contained' : 'outlined'}
            color={expanded ? 'secondary' : 'primary'}
            endIcon={expanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
            onClick={() => onToggleExpanded(cred.id)}
          >
            {expanded ? 'Detayı kapat' : 'Detayı aç'}
          </Button>
          <IconButton size="small" onClick={() => onEdit(cred)}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => onDelete(cred.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Stack>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2.25, pb: 2.25, borderTop: 1, borderColor: 'divider' }}>
          <Grid container spacing={1.25} sx={{ mt: 1.25 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 1.4, borderRadius: 3, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">Parola karmaşıklığı: </Typography>
                <StrengthBadge label={cred.strength_label} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 1.4, borderRadius: 3, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">Güvenlik durumu: </Typography>
                <SecurityStatusChip cred={cred} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 1.4, borderRadius: 3, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">Son güncelleme: </Typography>
                <Typography component="span" variant="caption" fontWeight={700}>
                  {cred.updated_at ? new Date(cred.updated_at).toLocaleDateString('tr-TR') : '—'}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 1.4, borderRadius: 3, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">Şifre ihlali: </Typography>
                {cred.is_breached
                  ? <Typography component="span" variant="caption" fontWeight={700} color="error.main">Evet — {cred.breach_count.toLocaleString()} kez</Typography>
                  : <Typography component="span" variant="caption" fontWeight={700} color="success.main">Hayır</Typography>
                }
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 1.4, borderRadius: 3, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">E-posta ihlali: </Typography>
                {cred.email_breached
                  ? <Typography component="span" variant="caption" fontWeight={700} color="error.main">Evet — {cred.email_breach_count} kez</Typography>
                  : <Typography component="span" variant="caption" fontWeight={700} color="success.main">Hayır — 0</Typography>
                }
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ p: 1.4, borderRadius: 3, bgcolor: 'background.default', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary">Parola: </Typography>
                <Typography component="code" sx={{ fontFamily: 'monospace', color: 'info.main', fontSize: '0.875rem' }}>
                  {show ? cred.password : '••••••••'}
                </Typography>
                <Button size="small" onClick={() => setShow(s => !s)}>
                  {show ? 'Gizle' : 'Göster'}
                </Button>
                <Button size="small" onClick={() => navigator.clipboard.writeText(cred.password)}>
                  Kopyala
                </Button>
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ p: 1.4, borderRadius: 3, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">Oluşturuldu: </Typography>
                <Typography component="span" variant="caption">{new Date(cred.created_at).toLocaleString('tr-TR')}</Typography>
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 2 }}>Güncellendi: </Typography>
                <Typography component="span" variant="caption">{new Date(cred.updated_at).toLocaleString('tr-TR')}</Typography>
              </Box>
            </Grid>
            {(cred.is_breached || cred.email_breached) && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="error" variant="outlined" sx={{ py: 0.5 }}>
                  {cred.is_breached && <div>Bu parola <strong>{cred.breach_count.toLocaleString()}</strong> kez ihlal veritabanında görüldü. Hemen değiştirin.</div>}
                  {cred.email_breached && <div>Bu e-posta <strong>{cred.email_breach_count}</strong> farklı ihlalde yer alıyor.</div>}
                </Alert>
              </Grid>
            )}
          </Grid>

          {/* TOTP Section */}
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <QrCodeIcon fontSize="small" color="info" />
            <Typography variant="body2" fontWeight={600}>TOTP Kodu</Typography>
            <Button size="small" onClick={() => setShowTOTP(v => !v)}>
              {showTOTP ? 'Gizle' : 'Göster'}
            </Button>
          </Stack>
          <Collapse in={showTOTP}>
            <TOTPPanel credId={cred.id} />
          </Collapse>

          {/* History Section */}
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <HistoryIcon fontSize="small" color="action" />
            <Typography variant="body2" fontWeight={600}>Şifre Geçmişi</Typography>
            <Button size="small" onClick={() => setShowHistory(v => !v)}>
              {showHistory ? 'Gizle' : 'Göster'}
            </Button>
          </Stack>
          <Collapse in={showHistory}>
            <HistoryPanel credId={cred.id} />
          </Collapse>
        </Box>
      </Collapse>
    </Card>
  )
}

function CredentialModal({ open, initial, onClose, onSave }) {
  const [form, setForm] = useState({ site_name: '', site_username: '', password: '', category: 'other' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const isEdit = !!initial

  useEffect(() => {
    if (initial) setForm({ site_name: initial.site_name, site_username: initial.site_username, password: '', category: initial.category })
    else setForm({ site_name: '', site_username: '', password: '', category: 'other' })
    setError('')
    setShowPw(false)
  }, [initial, open])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      if (isEdit) {
        const body = { site_name: form.site_name, site_username: form.site_username, category: form.category }
        if (form.password) body.password = form.password
        await api.updatePassword(initial.id, body)
      } else {
        await api.addPassword(form)
      }
      onSave()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? 'Düzenle' : 'Yeni Credential'}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent>
          <TextField fullWidth required label="Site / Uygulama Adı"
            value={form.site_name} onChange={set('site_name')} sx={{ mb: 2 }} />
          <TextField fullWidth required label="Kullanıcı Adı / E-posta"
            value={form.site_username} onChange={set('site_username')} sx={{ mb: 2 }} />
          <TextField
            fullWidth
            label={isEdit ? 'Yeni Şifre (boş bırakırsan değişmez)' : 'Şifre'}
            type={showPw ? 'text' : 'password'}
            required={!isEdit}
            value={form.password}
            onChange={set('password')}
            helperText="Kayıt sırasında HIBP ihlal kontrolü otomatik yapılır."
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPw(v => !v)}>
                      {showPw ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Kategori</InputLabel>
            <Select value={form.category} onChange={set('category')} label="Kategori">
              {['other','email','banking','social','work'].map(c => (
                <MenuItem key={c} value={c}>{CAT_LABELS[c]}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>İptal</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            Kaydet
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

function BulkCategoryDialog({ open, onClose, onConfirm }) {
  const [cat, setCat] = useState('other')
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Toplu Kategori Değiştir</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <InputLabel>Yeni Kategori</InputLabel>
          <Select value={cat} onChange={e => setCat(e.target.value)} label="Yeni Kategori">
            {['email','banking','social','work','other'].map(c => (
              <MenuItem key={c} value={c}>{CAT_LABELS[c]}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>İptal</Button>
        <Button variant="contained" onClick={() => onConfirm(cat)}>Uygula</Button>
      </DialogActions>
    </Dialog>
  )
}

export default function PasswordsTab({ navigationTarget }) {
  const [creds, setCreds] = useState([])
  const [aiInsights, setAIInsights] = useState(null)
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, initial: null })
  const [selected, setSelected] = useState(new Set())
  const [bulkCatOpen, setBulkCatOpen] = useState(false)
  const [bulkMsg, setBulkMsg] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const [handledNavigationNonce, setHandledNavigationNonce] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [passwords, insights] = await Promise.all([
        api.getPasswords(category || undefined),
        api.getAIInsights().catch(() => null),
      ])
      setCreds(passwords)
      setAIInsights(insights)
      setSelected(new Set())
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { load() }, [load])

  function onSelect(id, checked) {
    setSelected(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === creds.length) setSelected(new Set())
    else setSelected(new Set(creds.map(c => c.id)))
  }

  function toggleExpanded(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function focusCredential(id) {
    setExpandedId(id)
    setHighlightedId(id)
    window.setTimeout(() => {
      document.getElementById(`cred-row-${id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 120)
    window.setTimeout(() => {
      setHighlightedId(current => current === id ? null : current)
    }, 2600)
  }

  async function handleDelete(id) {
    if (!confirm('Bu credential silinsin mi?')) return
    await api.deletePassword(id)
    load()
  }

  async function handleBulkDelete() {
    if (!confirm(`${selected.size} credential silinsin mi?`)) return
    setBulkMsg(null)
    try {
      const res = await api.bulkDelete([...selected])
      setBulkMsg({ type: 'success', text: `${res.deleted} credential silindi.` })
      load()
    } catch (e) {
      setBulkMsg({ type: 'error', text: e.message })
    }
  }

  async function handleBulkCategory(cat) {
    setBulkCatOpen(false); setBulkMsg(null)
    try {
      const res = await api.bulkUpdateCategory([...selected], cat)
      setBulkMsg({ type: 'success', text: `${res.updated} credential güncellendi.` })
      load()
    } catch (e) {
      setBulkMsg({ type: 'error', text: e.message })
    }
  }

  useEffect(() => {
    if (navigationTarget?.tabId !== 'passwords' || loading) return
    if (handledNavigationNonce === navigationTarget.nonce) return

    if (category) {
      setCategory('')
      return
    }

    const targetIds = navigationTarget.credentialIds?.length
      ? navigationTarget.credentialIds
      : navigationTarget.credentialId
        ? [navigationTarget.credentialId]
        : []

    if (targetIds.length === 0) {
      setHandledNavigationNonce(navigationTarget.nonce)
      return
    }

    const targetCreds = creds.filter(cred => targetIds.includes(cred.id))
    if (targetCreds.length === 0) {
      setHandledNavigationNonce(navigationTarget.nonce)
      return
    }

    const primary = targetCreds[0]
    setExpandedId(primary.id)
    setHighlightedId(primary.id)

    if (navigationTarget.intent === 'edit') {
      setModal({ open: true, initial: primary })
    }

    if (navigationTarget.intent === 'review-reuse') {
      setSelected(new Set(targetCreds.map(cred => cred.id)))
      setBulkMsg({
        type: 'info',
        text: `Tekrar kullanılan ${targetCreds.length} kayıt seçildi. Bu kayıtların parolalarını birbirinden ayırabilirsin.`,
      })
    }

    setHandledNavigationNonce(navigationTarget.nonce)

    window.setTimeout(() => {
      document.getElementById(`cred-row-${primary.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 120)

    const timer = window.setTimeout(() => {
      setHighlightedId(current => current === primary.id ? null : current)
    }, 2600)

    return () => window.clearTimeout(timer)
  }, [navigationTarget, loading, handledNavigationNonce, category, creds])

  return (
    <Box>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', lg: 'center' }} justifyContent="space-between">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Kategori</InputLabel>
                <Select value={category} onChange={e => setCategory(e.target.value)} label="Kategori">
                  {CATEGORIES.map(c => <MenuItem key={c} value={c}>{CAT_LABELS[c]}</MenuItem>)}
                </Select>
              </FormControl>
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setModal({ open: true, initial: null })}>
                Yeni kayıt
              </Button>
              {creds.length > 0 && (
                <Button size="small" variant="outlined" onClick={toggleSelectAll}>
                  {selected.size === creds.length ? 'Seçimi kaldır' : 'Tümünü seç'}
                </Button>
              )}
            </Stack>

            <Typography variant="body2" color="text.secondary">
              {creds.length} kayıt görüntüleniyor
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {aiInsights?.account_reviews?.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ p: 2.2 }}>
            <Typography variant="overline" sx={{ color: 'primary.light', letterSpacing: '0.1em' }}>
              Odak Kayıtlar
            </Typography>
            <Typography variant="h6" sx={{ mb: 1.5 }}>Öne Çıkan Kayıtlar</Typography>
            <Grid container spacing={1.5}>
              {aiInsights.account_reviews.map(item => (
                <Grid key={item.credential_id} size={{ xs: 12, md: 6, xl: 4 }}>
                  <Box
                    sx={{
                      p: 1.7,
                      height: '100%',
                      minWidth: 0,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: 'linear-gradient(180deg, rgba(11, 25, 31, 0.98) 0%, rgba(6, 17, 22, 0.98) 100%)',
                    }}
                  >
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1} sx={{ mb: 1 }}>
                      <Typography fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{item.site_name}</Typography>
                      <Box
                        sx={{
                          px: 1.1,
                          py: 0.6,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'warning.main',
                          bgcolor: 'rgba(240,168,71,0.08)',
                          maxWidth: '100%',
                        }}
                      >
                        <Typography variant="caption" color="warning.main" sx={{ lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                          {item.status_label}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, mb: 1, overflowWrap: 'anywhere' }}>
                      {item.summary}
                    </Typography>
                    <Typography variant="caption" color="primary.light" sx={{ display: 'block', lineHeight: 1.65, mb: 1.25, overflowWrap: 'anywhere' }}>
                      Öneri: {item.recommendation}
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => focusCredential(item.credential_id)}>
                      Kayda git
                    </Button>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" mb={2} sx={{ p: 1.5, bgcolor: 'rgba(99, 216, 204, 0.08)', border: '1px solid', borderColor: 'divider', borderRadius: 3, flexWrap: 'wrap' }}>
          <Typography variant="body2">{selected.size} seçildi</Typography>
          <Button size="small" color="error" variant="contained" onClick={handleBulkDelete} startIcon={<DeleteIcon />}>
            Toplu Sil
          </Button>
          <Button size="small" variant="outlined" onClick={() => setBulkCatOpen(true)}>
            Kategori Değiştir
          </Button>
        </Stack>
      )}

      {bulkMsg && <Alert severity={bulkMsg.type} sx={{ mb: 2 }} onClose={() => setBulkMsg(null)}>{bulkMsg.text}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress /></Box>
      ) : creds.length === 0 ? (
        <Typography color="text.secondary">Henüz kayıt yok.</Typography>
      ) : (
        creds.map(c => (
          <CredentialRow key={c.id} cred={c}
            expanded={expandedId === c.id}
            highlighted={highlightedId === c.id}
            onToggleExpanded={toggleExpanded}
            selected={selected.has(c.id)}
            onSelect={onSelect}
            onEdit={cred => setModal({ open: true, initial: cred })}
            onDelete={handleDelete}
          />
        ))
      )}

      <CredentialModal
        open={modal.open}
        initial={modal.initial}
        onClose={() => setModal({ open: false, initial: null })}
        onSave={load}
      />
      <BulkCategoryDialog
        open={bulkCatOpen}
        onClose={() => setBulkCatOpen(false)}
        onConfirm={handleBulkCategory}
      />
    </Box>
  )
}

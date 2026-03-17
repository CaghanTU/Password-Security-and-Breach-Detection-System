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

const CATEGORIES = ['', 'email', 'banking', 'social', 'work', 'other']
const CAT_LABELS  = { '': 'Tümü', email: 'E-posta', banking: 'Bankacılık', social: 'Sosyal', work: 'İş', other: 'Diğer' }
const STRENGTH_COLOR = { weak: 'error', medium: 'warning', strong: 'success' }
const STRENGTH_TEXT = { weak: 'zayıf', medium: 'orta', strong: 'güçlü' }

function StrengthBadge({ label }) {
  return <Chip label={STRENGTH_TEXT[label] ?? label} size="small" color={STRENGTH_COLOR[label] ?? 'default'} />
}

function SecurityStatusChip({ cred }) {
  const critical = cred.is_breached || cred.email_breached || cred.breach_date_status === 'not_rotated'
  const warning = cred.is_stale
  if (critical) return <Chip label="güvenlik: riskli" size="small" color="error" />
  if (warning) return <Chip label="güvenlik: dikkat" size="small" color="warning" />
  return <Chip label="güvenlik: iyi" size="small" color="success" />
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
      } catch (_) {}
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
          placeholder="TOTP Secret (BASE32)"
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

function CredentialRow({ cred, onEdit, onDelete, selected, onSelect }) {
  const [show, setShow] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showTOTP, setShowTOTP] = useState(false)

  const sinceUpdate = cred.updated_at
    ? Math.floor((Date.now() - new Date(cred.updated_at)) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Card sx={{ mb: 1, outline: selected ? '2px solid' : 'none', outlineColor: 'primary.main' }}>
      <Box
        sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <Stack direction="row" alignItems="center" spacing={1} onClick={e => e.stopPropagation()}>
          <Checkbox size="small" checked={selected} onChange={e => onSelect(cred.id, e.target.checked)} />
        </Stack>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="span" fontWeight={600}>{cred.site_name}</Typography>
          <Chip label={cred.category} size="small" sx={{ ml: 1, textTransform: 'uppercase' }} />
          {cred.is_stale && <Chip label="Eski" size="small" color="warning" sx={{ ml: 0.5 }} />}
          {cred.is_breached && (
            <Chip
              label={`⚠ Şifre İhlal${cred.breach_count > 0 ? ` (${cred.breach_count.toLocaleString()}×)` : ''}`}
              size="small" color="error" sx={{ ml: 0.5 }}
            />
          )}
          {cred.email_breached && (
            <Chip label={`✉ E-posta İhlal (${cred.email_breach_count})`} size="small" color="error" sx={{ ml: 0.5 }} />
          )}
          {cred.breach_date_status === 'not_rotated' && <Chip label="Güncellenmedi ✗" size="small" color="error" sx={{ ml: 0.5 }} />}
          {cred.breach_date_status === 'changed_after' && <Chip label="Güncellendi ✓" size="small" color="success" sx={{ ml: 0.5 }} />}
          {cred.totp_secret && <Chip label="TOTP" size="small" color="info" sx={{ ml: 0.5 }} icon={<QrCodeIcon />} />}
          <br />
          <Typography variant="caption" color="text.secondary">{cred.site_username}</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" onClick={e => e.stopPropagation()}>
          <SecurityStatusChip cred={cred} />
          <StrengthBadge label={cred.strength_label} />
          <Typography
            component="code"
            sx={{ fontFamily: 'monospace', color: 'info.main', cursor: 'pointer', fontSize: '0.875rem' }}
            onClick={() => setShow(s => !s)}
          >
            {show ? cred.password : '••••••••'}
          </Typography>
          <IconButton size="small" onClick={() => onEdit(cred)}><EditIcon fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={() => onDelete(cred.id)}><DeleteIcon fontSize="small" /></IconButton>
        </Stack>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2, borderTop: 1, borderColor: 'divider' }}>
          <Grid container spacing={1} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">Parola karmaşıklığı: </Typography>
                <StrengthBadge label={cred.strength_label} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">Güvenlik durumu: </Typography>
                <SecurityStatusChip cred={cred} />
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">Yaş: </Typography>
                <Typography component="span" variant="caption" fontWeight={700}>
                  {sinceUpdate !== null ? `${sinceUpdate} gün` : '—'}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">Şifre ihlali: </Typography>
                {cred.is_breached
                  ? <Typography component="span" variant="caption" fontWeight={700} color="error.main">Evet — {cred.breach_count.toLocaleString()} kez</Typography>
                  : <Typography component="span" variant="caption" fontWeight={700} color="success.main">Hayır</Typography>
                }
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">E-posta ihlali: </Typography>
                {cred.email_breached
                  ? <Typography component="span" variant="caption" fontWeight={700} color="error.main">Evet — {cred.email_breach_count} kez</Typography>
                  : <Typography component="span" variant="caption" fontWeight={700} color="success.main">Hayır — 0</Typography>
                }
              </Box>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'background.default' }}>
                <Typography variant="caption" color="text.secondary">Oluşturuldu: </Typography>
                <Typography component="span" variant="caption">{new Date(cred.created_at).toLocaleString('tr-TR')}</Typography>
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 2 }}>Güncellendi: </Typography>
                <Typography component="span" variant="caption">{new Date(cred.updated_at).toLocaleString('tr-TR')}</Typography>
              </Box>
            </Grid>
            {(cred.is_breached || cred.email_breached) && (
              <Grid size={{ xs: 12 }}>
                <Alert severity="error" variant="outlined" sx={{ py: 0.5 }}>
                  {cred.is_breached && <div>⚠ Şifre <strong>{cred.breach_count.toLocaleString()}</strong> kez ihlal veritabanında. Hemen değiştirin.</div>}
                  {cred.email_breached && <div>✉ Bu e-posta <strong>{cred.email_breach_count}</strong> farklı ihlalde görünmüş.</div>}
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
                      {showPw ? '🙈' : '👁'}
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

export default function PasswordsTab() {
  const [creds, setCreds] = useState([])
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState({ open: false, initial: null })
  const [selected, setSelected] = useState(new Set())
  const [bulkCatOpen, setBulkCatOpen] = useState(false)
  const [bulkMsg, setBulkMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCreds(await api.getPasswords(category || undefined))
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

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" mb={2} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Kategori</InputLabel>
          <Select value={category} onChange={e => setCategory(e.target.value)} label="Kategori">
            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{CAT_LABELS[c]}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="contained" onClick={() => setModal({ open: true, initial: null })}>
          + Ekle
        </Button>
        {creds.length > 0 && (
          <Button size="small" variant="outlined" onClick={toggleSelectAll}>
            {selected.size === creds.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
          </Button>
        )}
      </Stack>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" mb={2} sx={{ p: 1.5, bgcolor: 'action.selected', borderRadius: 1 }}>
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

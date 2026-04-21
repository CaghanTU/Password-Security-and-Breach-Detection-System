import { useState } from 'react'
import { api } from '../services/api'
import {
  Box, Card, CardContent, Typography, Slider, FormControlLabel,
  Checkbox, Button, TextField, Alert, CircularProgress, Chip,
  Stack, Grid, Paper, Collapse,
} from '@mui/material'

export default function GeneratorTab() {
  const [opts, setOpts] = useState({
    length: 16,
    use_upper: true,
    use_lower: true,
    use_digits: true,
    use_symbols: true,
    min_digits: 0,
    min_symbols: 0,
    prefix: '',
    suffix: '',
    custom_chars: '',
  })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const set = k => v => setOpts(o => ({ ...o, [k]: v }))
  const toggle = k => setOpts(o => ({ ...o, [k]: !o[k] }))

  async function generate() {
    setError(''); setLoading(true); setCopied(false)
    try { setResult(await api.generate(opts)) }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function copy() {
    navigator.clipboard.writeText(result.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const strengthColor = { weak: 'error', medium: 'warning', strong: 'success' }
  const prefixLen = opts.prefix.length
  const suffixLen = opts.suffix.length
  const coreLen = Math.max(0, opts.length - prefixLen - suffixLen)
  const mandatoryConflict = (opts.min_digits + opts.min_symbols) > coreLen

  return (
    <Card sx={{ maxWidth: 560 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" mb={3}>Generate Secure Password</Typography>

        {/* Uzunluk */}
        <Box mb={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">Random section length</Typography>
            <Typography variant="body2" fontWeight={700}>
              {opts.length} characters
              {(prefixLen || suffixLen) ? ` (core: ${coreLen}, total: ${prefixLen + coreLen + suffixLen})` : ''}
            </Typography>
          </Box>
          <Slider min={4} max={128} value={opts.length} onChange={(_, v) => set('length')(v)} />
        </Box>

        {/* Karakter seti */}
        <Grid container spacing={1} mb={2}>
          {[
            ['use_upper', 'Uppercase (A-Z)'],
            ['use_lower', 'Lowercase (a-z)'],
            ['use_digits', 'Digits (0-9)'],
            ['use_symbols', 'Symbols (!@#...)'],
          ].map(([k, label]) => (
            <Grid size={{ xs: 6 }} key={k}>
              <FormControlLabel
                control={<Checkbox checked={opts[k]} onChange={() => toggle(k)} size="small" />}
                label={<Typography variant="body2">{label}</Typography>}
              />
            </Grid>
          ))}
        </Grid>

        {/* Advanced options toggle */}
        <Button variant="outlined" size="small" onClick={() => setShowAdvanced(v => !v)} sx={{ mb: 2 }}>
          {showAdvanced ? 'Hide advanced options' : 'Advanced options'}
        </Button>

        <Collapse in={showAdvanced}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} mb={2}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption">Min. Digit Count: <strong>{opts.min_digits}</strong></Typography>
                <Slider min={0} max={Math.min(20, opts.length)} value={opts.min_digits}
                  onChange={(_, v) => set('min_digits')(v)} size="small" />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption">Min. Symbol Count: <strong>{opts.min_symbols}</strong></Typography>
                <Slider min={0} max={Math.min(20, opts.length)} value={opts.min_symbols}
                  onChange={(_, v) => set('min_symbols')(v)} size="small" />
              </Grid>
            </Grid>

            <Grid container spacing={2} mb={2}>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth size="small" label="Prefix" placeholder="e.g. MyApp-"
                  value={opts.prefix} inputProps={{ maxLength: 32 }}
                  onChange={e => set('prefix')(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth size="small" label="Suffix" placeholder="e.g. -2026"
                  value={opts.suffix} inputProps={{ maxLength: 32 }}
                  onChange={e => set('suffix')(e.target.value)} />
              </Grid>
            </Grid>

            <TextField fullWidth size="small" label="Extra characters (added to charset)"
              placeholder="e.g. ₺€£ or custom symbols"
              value={opts.custom_chars} inputProps={{ maxLength: 64 }}
              onChange={e => set('custom_chars')(e.target.value)} />
          </Paper>
        </Collapse>

        <Button variant="contained" color="success" fullWidth onClick={generate} disabled={loading}>
          {loading ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
          Generate password
        </Button>

        {mandatoryConflict && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Min. digits + symbols ({opts.min_digits + opts.min_symbols}) exceeds the core length ({coreLen}).
            Values will be reduced automatically so space remains for uppercase/lowercase characters as well.
          </Alert>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        {result && (
          <Box mt={3}>
            <Paper
              onClick={copy}
              title="Click to copy"
              sx={{
                p: 2, fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer',
                wordBreak: 'break-all', fontSize: '1rem', color: 'success.light',
                bgcolor: 'background.default',
              }}
            >
              {result.password}
            </Paper>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mt={1}>
              <Chip label={result.strength_label} size="small" color={strengthColor[result.strength_label] ?? 'default'} />
              <Typography variant="caption" color="text.secondary">
                Entropi: <strong>{result.entropy_bits} bit</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Toplam uzunluk: <strong>{result.password.length}</strong>
              </Typography>
              {copied && <Chip label="Copied" size="small" color="info" />}
            </Stack>
            <Typography variant="caption" color="text.secondary">Click the password to copy it to the clipboard</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

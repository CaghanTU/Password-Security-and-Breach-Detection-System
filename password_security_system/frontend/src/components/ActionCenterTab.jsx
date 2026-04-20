import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Stack, Typography,
} from '@mui/material'
import AIAdvisorCard from './AIAdvisorCard'

const PRIORITY_COLOR = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default',
}

function SummaryCard({ label, value, helper, color = 'text.primary' }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={800} color={color}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{helper}</Typography>
      </CardContent>
    </Card>
  )
}

function FollowUpRow({ item, resolved = false }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Typography fontWeight={700}>{item.site_name || 'Kayıt'}</Typography>
        <Chip
          size="small"
          color={resolved ? 'success' : 'error'}
          label={resolved ? 'çözüldü' : 'açık takip'}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary" mt={1}>
        {item.breach_names?.length
          ? `İlgili ihlaller: ${item.breach_names.join(', ')}`
          : 'İlgili ihlal bilgisi takip ediliyor.'}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
        {resolved ? 'Kapanış' : 'Son güncelleme'}:{' '}
        {new Date((resolved ? item.resolved_at : item.updated_at) || item.created_at).toLocaleString('tr-TR')}
      </Typography>
    </Box>
  )
}

function targetTabForAction(item) {
  if (item.kind === 'recovery_codes') {
    return { tabId: 'twofa', section: 'recovery' }
  }
  if (item.kind === 'totp_bonus') {
    return { tabId: 'twofa', section: 'totp' }
  }
  if (item.kind === 'weak_password' || item.kind === 'stale_password' || item.kind === 'breach_followup') {
    return {
      tabId: 'passwords',
      intent: 'edit',
      credentialId: item.credential_id ?? null,
    }
  }
  if (item.kind === 'reused_password') {
    return {
      tabId: 'passwords',
      intent: 'review-reuse',
      credentialIds: item.credential_ids ?? [],
      credentialId: item.credential_id ?? item.credential_ids?.[0] ?? null,
    }
  }
  return null
}

export default function ActionCenterTab({ onNavigateTab }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiInsights, setAIInsights] = useState(null)
  const [aiLoading, setAILoading] = useState(true)
  const [aiError, setAIError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setAILoading(true)
    try {
      const [actionData, insightsData] = await Promise.all([
        api.getActionCenter(),
        api.getAIInsights().catch(() => null),
      ])
      setData(actionData)
      setAIInsights(insightsData)
      setAIError(insightsData ? '' : 'AI summary unavailable')
    } finally {
      setLoading(false)
      setAILoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress /></Box>
  }

  if (!data) {
    return null
  }

  const { summary, actions, open_follow_up: openFollowUp, recently_resolved: recentlyResolved } = data

  function handleActionClick(item) {
    const target = targetTabForAction(item)
    if (target && onNavigateTab) {
      onNavigateTab(target.tabId, target)
    }
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <AIAdvisorCard
          title="Aksiyon Özeti"
          eyebrow="Akıllı Yorum"
          data={aiInsights?.briefing ?? null}
          loading={aiLoading}
          error={aiError}
          onRefresh={load}
        />
      </Box>

      {aiInsights && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="overline" sx={{ color: 'secondary.light', letterSpacing: '0.1em' }}>
              48 Saat
            </Typography>
            <Typography variant="h6" sx={{ mb: 2 }}>48 Saatlik Müdahale Planı</Typography>
            <Grid container spacing={1.5}>
              {aiInsights.plan_48h.map((item, index) => (
                <Grid key={`${item.window}-${index}`} size={{ xs: 12, md: 4 }}>
                  <Box
                    sx={{
                      p: 1.7,
                      height: '100%',
                      minWidth: 0,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                    }}
                  >
                    <Typography variant="overline" sx={{ color: 'primary.light', letterSpacing: '0.08em' }}>
                      {item.window}
                    </Typography>
                    <Typography fontWeight={800} sx={{ mt: 0.45, mb: 0.75, overflowWrap: 'anywhere' }}>{item.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, overflowWrap: 'anywhere' }}>
                      {item.detail}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard label="Anlık Skor" value={summary.current_score} helper="Risk skorun" color="primary.main" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard label="Açık Aksiyon" value={summary.open_actions} helper="Önceliklendirilmiş iş listesi" color="warning.main" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard label="Açık Breach Takibi" value={summary.unresolved_breach_cases} helper="Henüz kapanmamış vakalar" color="error.main" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SummaryCard label="Recovery Code" value={summary.recovery_codes_remaining} helper="Kalan yedek kod" color="info.main" />
        </Grid>
      </Grid>

      {actions.length === 0 ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          Öncelikli açık aksiyon görünmüyor. Düzenli taramaya devam edebilirsin.
        </Alert>
      ) : (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} gap={1} flexWrap="wrap">
              <Typography variant="h6">Öncelikli Aksiyonlar</Typography>
              <Typography variant="body2" color="text.secondary">
                Kritik: {summary.critical_actions} · Yüksek: {summary.high_actions} · Orta: {summary.medium_actions}
              </Typography>
            </Stack>
            <Stack spacing={1.5}>
              {actions.map(item => (
                <Box
                  key={item.id}
                  sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    justifyContent="space-between"
                    gap={1.5}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap mb={0.75}>
                        <Chip size="small" color={PRIORITY_COLOR[item.priority] ?? 'default'} label={item.priority} />
                        {item.site_name && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={item.site_name}
                            sx={{ maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                          />
                        )}
                        {item.estimated_score_gain > 0 && (
                          <Chip size="small" color="success" variant="outlined" label={`+${item.estimated_score_gain} puan potansiyel`} />
                        )}
                      </Stack>
                      <Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary" mt={0.5} sx={{ overflowWrap: 'anywhere' }}>{item.description}</Typography>
                      {item.ai_reason && (
                        <Typography variant="caption" color="primary.light" display="block" mt={1} sx={{ lineHeight: 1.65, overflowWrap: 'anywhere' }}>
                          Neden şimdi: {item.ai_reason}
                        </Typography>
                      )}
                    </Box>
                    <Button
                      variant="text"
                      color="primary"
                      onClick={() => handleActionClick(item)}
                      sx={{ fontWeight: 700, whiteSpace: 'nowrap', alignSelf: { xs: 'flex-start', md: 'center' } }}
                    >
                      {item.action_label}
                    </Button>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" mb={2}>Breach Sonrası Takip</Typography>
              {openFollowUp.length === 0 ? (
                <Alert severity="success">Açık breach follow-up vakası görünmüyor.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {openFollowUp.map(item => <FollowUpRow key={item.id} item={item} />)}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" mb={2}>Yakın Zamanda Kapananlar</Typography>
              {recentlyResolved.length === 0 ? (
                <Alert severity="info">Henüz kapanmış breach vakası yok.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {recentlyResolved.map(item => <FollowUpRow key={item.id} item={item} resolved />)}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

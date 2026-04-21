import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Stack, Typography,
} from '@mui/material'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import BoltRoundedIcon from '@mui/icons-material/BoltRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import { api } from '../services/api'

function toneFromRisk(text = '') {
  const lower = text.toLowerCase()
  if (lower.includes('critical') || lower.includes('high')) return 'error'
  if (lower.includes('medium') || lower.includes('attention')) return 'warning'
  if (lower.includes('good') || lower.includes('strong')) return 'success'
  return 'info'
}

function riskLabelFromText(text = '') {
  const lower = text.toLowerCase()
  if (lower.includes('critical') || lower.includes('high')) return 'High risk'
  if (lower.includes('medium') || lower.includes('attention')) return 'Medium risk'
  if (lower.includes('good') || lower.includes('strong')) return 'Balanced view'
  return 'Monitoring'
}

export default function AIAdvisorCard({
  title = 'Security Summary',
  eyebrow = 'Smart Summary',
  data: externalData = null,
  loading: externalLoading = false,
  error: externalError = '',
  onRefresh = null,
}) {
  const [data, setData] = useState(externalData)
  const [loading, setLoading] = useState(externalData ? false : true)
  const [error, setError] = useState('')
  const isControlled = externalData !== null || externalLoading || Boolean(externalError) || Boolean(onRefresh)
  const activeData = externalData || data

  const load = useCallback(async () => {
    if (isControlled) return
    setLoading(true)
    setError('')
    try {
      setData(await api.getAIAdvisor())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isControlled])

  useEffect(() => {
    if (isControlled) {
      setData(externalData)
      setLoading(Boolean(externalLoading))
      setError(externalError || '')
      return
    }
    load()
  }, [load, externalData, externalLoading, externalError, isControlled])

  return (
    <Card sx={{ height: '100%', overflow: 'hidden' }}>
      <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          gap={1.5}
          sx={{ mb: 2 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: 'primary.light', letterSpacing: '0.12em' }}>
              {eyebrow}
            </Typography>
            <Typography variant="h6">{title}</Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={onRefresh || load}
            disabled={loading || Boolean(externalLoading)}
            sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, flexShrink: 0 }}
          >
            Refresh
          </Button>
        </Stack>

        {(loading || externalLoading) ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (error || externalError) ? (
          <Alert severity="warning">The summary could not be prepared right now. Please try again in a few seconds.</Alert>
        ) : activeData ? (
          <Stack spacing={2.5}>
            <Box
              sx={{
                position: 'relative',
                overflow: 'hidden',
                p: { xs: 2, md: 2.5 },
                borderRadius: 4,
                border: '1px solid',
                borderColor: 'divider',
                background: 'linear-gradient(135deg, rgba(99,216,204,0.14) 0%, rgba(16,32,40,0.92) 42%, rgba(11,19,25,0.98) 100%)',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  width: 220,
                  height: 220,
                  right: -90,
                  top: -120,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(241,191,102,0.20) 0%, rgba(241,191,102,0) 72%)',
                },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
                <Box sx={{ maxWidth: 760, minWidth: 0, position: 'relative', zIndex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" mb={1.25} flexWrap="wrap" useFlexGap>
                    <Chip
                      icon={<AutoAwesomeRoundedIcon />}
                      label="Operations Briefing"
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={riskLabelFromText(activeData.risk_posture)}
                      color={toneFromRisk(activeData.risk_posture)}
                      variant="filled"
                    />
                  </Stack>
                  <Typography variant="h5" sx={{ mb: 1.1, overflowWrap: 'anywhere' }}>
                    {activeData.headline}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      lineHeight: 1.8,
                      color: 'text.secondary',
                      maxWidth: 700,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {activeData.summary}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    width: { xs: '100%', md: 320 },
                    maxWidth: { md: 320 },
                    p: 1.75,
                    minWidth: 0,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'rgba(255,255,255,0.08)',
                    bgcolor: 'rgba(5, 13, 18, 0.44)',
                    backdropFilter: 'blur(10px)',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    <BoltRoundedIcon fontSize="small" color="secondary" />
                    <Typography variant="subtitle2">Recommended First Move</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ lineHeight: 1.75, overflowWrap: 'anywhere' }}>
                    {activeData.next_step}
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Box
                  sx={{
                    p: 2,
                    height: '100%',
                    minWidth: 0,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                    <InsightsRoundedIcon fontSize="small" color="info" />
                    <Typography variant="subtitle2">Why Now?</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, overflowWrap: 'anywhere' }}>
                    {activeData.why_now}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <Box
                  sx={{
                    p: 2,
                    height: '100%',
                    minWidth: 0,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 1.1 }}>Analyst Note</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, overflowWrap: 'anywhere' }}>
                    {activeData.risk_posture}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1.25 }}>Focus Areas</Typography>
              <Grid container spacing={1.5}>
                {activeData.priorities.map((item, index) => (
                  <Grid key={`${item.title}-${index}`} size={{ xs: 12, md: 6, xl: 4 }}>
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
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} sx={{ mb: 1 }}>
                        <Typography variant="overline" sx={{ color: 'primary.light', letterSpacing: '0.1em' }}>
                          Focus {String(index + 1).padStart(2, '0')}
                        </Typography>
                      </Stack>
                      <Typography fontWeight={800} sx={{ mb: 0.75, overflowWrap: 'anywhere' }}>{item.title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, overflowWrap: 'anywhere' }}>
                        {item.detail}
                      </Typography>
                      <Box
                        sx={{
                          mt: 1.25,
                          px: 1.2,
                          py: 0.8,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <Typography variant="caption" sx={{ color: 'primary.light', display: 'block', mb: 0.25 }}>
                          Expected impact
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, overflowWrap: 'anywhere' }}>
                          {item.impact}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  )
}

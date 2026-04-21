import { useCallback, useEffect, useState } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import {
  BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale,
  LineElement, PointElement, Tooltip,
} from 'chart.js'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Stack, Typography,
} from '@mui/material'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import AIAdvisorCard from './AIAdvisorCard'
import { api } from '../services/api'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

const CAT_LABELS = { email: 'Email', banking: 'Banking', social: 'Social', work: 'Work', other: 'Other' }
function pct(value) {
  return `${Math.round((value || 0) * 100)}%`
}

function bandText(band) {
  return {
    excellent: 'excellent',
    good: 'good',
    watch: 'watch',
    critical: 'critical',
  }[band] ?? band
}

function trendText(summary) {
  if (!summary) return 'Trend data is being prepared.'
  if (summary.trend_direction === 'improving') return 'Password health is improving.'
  if (summary.trend_direction === 'declining') return 'Risk pressure is increasing based on the latest snapshots.'
  if (summary.trend_direction === 'stable') return 'No significant change is visible in recent snapshots.'
  return 'More measurements are needed for a trend.'
}

function MetricTile({ label, value, helper, tone = 'default' }) {
  const color = {
    danger: 'error.main',
    warning: 'warning.main',
    success: 'success.main',
    info: 'info.main',
    default: 'text.primary',
  }[tone] ?? 'text.primary'

  return (
    <Box
      sx={{
        p: 2,
        height: '100%',
        minWidth: 0,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.02)',
      }}
    >
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" color={color} sx={{ mt: 0.5 }}>{value}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{helper}</Typography>
    </Box>
  )
}

function SectionCard({ eyebrow, title, action, children }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          gap={1.5}
          sx={{ mb: 2.5 }}
        >
          <Box sx={{ minWidth: 0 }}>
            {eyebrow && (
              <Typography variant="overline" sx={{ color: 'primary.light', letterSpacing: '0.12em' }}>
                {eyebrow}
              </Typography>
            )}
            <Typography variant="h6" sx={{ mt: eyebrow ? 0.25 : 0 }}>
              {title}
            </Typography>
          </Box>
          {action ? <Box sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' }, flexShrink: 0 }}>{action}</Box> : null}
        </Stack>
        {children}
      </CardContent>
    </Card>
  )
}

export default function ScoreTab() {
  const [data, setData] = useState(null)
  const [aiInsights, setAIInsights] = useState(null)
  const [history, setHistory] = useState([])
  const [catStats, setCatStats] = useState([])
  const [healthTrend, setHealthTrend] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAILoading] = useState(true)
  const [aiError, setAIError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfErr, setPdfErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const scoreData = await api.getScore()
      const [historyData, categoryData, trendData, insightsData] = await Promise.all([
        api.getScoreHistory(),
        api.getScoreByCategory(),
        api.getHealthTrend(),
        api.getAIInsights().catch(() => null),
      ])
      setData(scoreData)
      setHistory(historyData)
      setCatStats(categoryData)
      setHealthTrend(trendData)
      setAIInsights(insightsData)
      setAIError(insightsData ? '' : 'AI summary unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAIOnly = useCallback(async () => {
    setAILoading(true)
    setAIError('')
    try {
      setAIInsights(await api.getAIInsights())
    } catch (err) {
      setAIError(err.message)
    } finally {
      setAILoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!loading) setAILoading(false)
  }, [loading])

  async function handleDownloadPDF() {
    setPdfLoading(true)
    setPdfErr('')
    try {
      const blob = await api.downloadReport()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'risk_report.pdf'
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setPdfErr(err.message)
    } finally {
      setPdfLoading(false)
    }
  }

  if (loading) {
    return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
  }

  if (!data) {
    return null
  }

  const breakdown = data.breakdown
  const scoreTone = data.score >= 85 ? 'success.main' : data.score >= 70 ? 'primary.main' : data.score >= 45 ? 'warning.main' : 'error.main'

  const historyChartData = {
    labels: history.map(item => new Date(item.calculated_at).toLocaleDateString('en-US')),
    datasets: [{
      label: 'Risk score',
      data: history.map(item => item.score),
      borderColor: '#63d8cc',
      backgroundColor: 'rgba(99, 216, 204, 0.14)',
      fill: true,
      tension: 0.35,
      pointRadius: 4,
      pointHoverRadius: 5,
    }],
  }

  const countChartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#94a4b8' } },
    },
    scales: {
      y: { ticks: { color: '#94a4b8', stepSize: 1 }, grid: { color: '#25333f' } },
      x: { ticks: { color: '#94a4b8' }, grid: { color: '#1a2430' } },
    },
  }

  const scoreChartOptions = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#94a4b8' } },
    },
    scales: {
      y: { min: 0, max: 100, ticks: { color: '#94a4b8' }, grid: { color: '#25333f' } },
      x: { ticks: { color: '#94a4b8' }, grid: { color: '#1a2430' } },
    },
  }

  const healthPoints = healthTrend?.points || []
  const healthChartData = {
    labels: healthPoints.map(point => new Date(point.created_at).toLocaleDateString('en-US')),
    datasets: [
      { label: 'Weak', data: healthPoints.map(point => point.weak_count), borderColor: '#ff6b5a', backgroundColor: 'rgba(255, 107, 90, 0.12)', tension: 0.3 },
      { label: 'Breached', data: healthPoints.map(point => point.breach_any_count), borderColor: '#f0a847', backgroundColor: 'rgba(240, 168, 71, 0.12)', tension: 0.3 },
      { label: 'Stale', data: healthPoints.map(point => point.stale_count), borderColor: '#ffd166', backgroundColor: 'rgba(255, 209, 102, 0.12)', tension: 0.3 },
      { label: 'Reused', data: healthPoints.map(point => point.reused_count), borderColor: '#67b7ff', backgroundColor: 'rgba(103, 183, 255, 0.12)', tension: 0.3 },
    ],
  }

  const categoryChartData = {
    labels: catStats.filter(item => item.total > 0).map(item => CAT_LABELS[item.category] ?? item.category),
    datasets: [
      { label: 'Weak', data: catStats.filter(item => item.total > 0).map(item => item.weak), backgroundColor: 'rgba(255, 107, 90, 0.8)' },
      { label: 'Breached', data: catStats.filter(item => item.total > 0).map(item => item.breached), backgroundColor: 'rgba(240, 168, 71, 0.8)' },
      { label: 'Stale', data: catStats.filter(item => item.total > 0).map(item => item.stale), backgroundColor: 'rgba(103, 183, 255, 0.8)' },
    ],
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <AIAdvisorCard
          title="Risk Summary"
          eyebrow="Smart Commentary"
          data={aiInsights?.briefing ?? null}
          loading={aiLoading}
          error={aiError}
          onRefresh={loadAIOnly}
        />
      </Grid>

      {aiInsights && (
        <>
          <Grid size={{ xs: 12, lg: 6 }}>
            <SectionCard eyebrow="Weekly" title={aiInsights.weekly_summary.headline}>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, mb: 2 }}>
                {aiInsights.weekly_summary.summary}
              </Typography>
              <Stack spacing={1.25}>
                {aiInsights.weekly_summary.watch_items.map((item, index) => (
                  <Box
                    key={`${item}-${index}`}
                    sx={{
                      p: 1.5,
                      minWidth: 0,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.default',
                      overflow: 'hidden',
                    }}
                  >
                    <Typography variant="overline" sx={{ color: 'primary.light', letterSpacing: '0.1em' }}>
                      Watch {index + 1}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, overflowWrap: 'anywhere' }}>
                      {item}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <SectionCard eyebrow="What-if" title="Scenario Simulator">
              <Stack spacing={1.25}>
                {aiInsights.what_if_scenarios.map((item, index) => (
                  <Box
                    key={`${item.title}-${index}`}
                    sx={{
                      p: 1.6,
                      minWidth: 0,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      gap={1}
                      sx={{ mb: 0.75 }}
                    >
                      <Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{item.title}</Typography>
                      <Box
                        sx={{
                          px: 1.2,
                          py: 0.6,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'success.main',
                          bgcolor: 'rgba(94,198,139,0.08)',
                          maxWidth: '100%',
                        }}
                      >
                        <Typography variant="caption" color="success.main" sx={{ lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                          {item.effect}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, overflowWrap: 'anywhere' }}>
                      {item.detail}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          </Grid>
        </>
      )}

      {aiInsights && (
        <Grid size={{ xs: 12 }}>
          <SectionCard eyebrow="48 Hours" title="48-Hour Intervention Plan">
            <Grid container spacing={1.5}>
              {aiInsights.plan_48h.map((item, index) => (
                <Grid key={`${item.window}-${index}`} size={{ xs: 12, md: 4 }}>
                  <Box
                    sx={{
                      p: 1.8,
                      height: '100%',
                      minWidth: 0,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: 'linear-gradient(180deg, rgba(12, 27, 32, 0.98) 0%, rgba(7, 18, 22, 0.98) 100%)',
                    }}
                  >
                    <Typography variant="overline" sx={{ color: 'secondary.light', letterSpacing: '0.1em' }}>
                      {item.window}
                    </Typography>
                    <Typography fontWeight={800} sx={{ mt: 0.4, mb: 0.8, overflowWrap: 'anywhere' }}>{item.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, overflowWrap: 'anywhere' }}>
                      {item.detail}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </SectionCard>
        </Grid>
      )}

      <Grid size={{ xs: 12 }}>
        <Card
          sx={{
            overflow: 'hidden',
            background: 'linear-gradient(140deg, rgba(15, 27, 35, 0.98) 0%, rgba(9, 16, 21, 0.98) 60%, rgba(17, 39, 37, 0.98) 100%)',
          }}
        >
          <CardContent sx={{ p: 3.25 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, lg: 4 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 3,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'rgba(99, 216, 204, 0.12)',
                        color: 'primary.light',
                      }}
                    >
                      <ShieldOutlinedIcon fontSize="small" />
                    </Box>
                    <Chip size="small" label={`Score band: ${bandText(breakdown.score_band)}`} color="primary" variant="outlined" />
                  </Stack>
                  <Typography variant="h4">
                    Your security posture is currently {data.score >= 70 ? 'in a good place' : data.score >= 45 ? 'needs monitoring' : 'under critical pressure'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                    The score is made up of weak passwords, breaches, reuse, stale records, and the TOTP bonus. Effects are independent and not added in a strictly direct way.
                  </Typography>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, lg: 3 }}>
                <Box sx={{ textAlign: { xs: 'left', lg: 'center' } }}>
                  <Typography sx={{ fontSize: { xs: '4.5rem', md: '5.5rem' }, lineHeight: 1, fontWeight: 900, color: scoreTone }}>
                    {data.score}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">Current security score out of 100</Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, lg: 5 }}>
                <Stack spacing={1.25}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                    <Button fullWidth variant="contained" startIcon={<RefreshRoundedIcon />} onClick={load}>
                      Recalculate
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="secondary"
                      startIcon={pdfLoading ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                      onClick={handleDownloadPDF}
                      disabled={pdfLoading}
                    >
                      Download PDF report
                    </Button>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                    Score, plan, and simulation areas are calculated directly from the risk model; the smart commentary layer explains that data in a clearer way.
                  </Typography>
                  {pdfErr && <Alert severity="error">{pdfErr}</Alert>}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <SectionCard eyebrow="Summary" title="Risk components">
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="Weak passwords" value={`${breakdown.weak_count} · ${pct(breakdown.weak_ratio)}`} helper="Direct heavy penalty factor" tone={breakdown.weak_count > 0 ? 'danger' : 'success'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="Breached records" value={`${breakdown.breach_any_count} · ${pct(breakdown.breach_any_ratio)}`} helper="Breach pressure" tone={breakdown.breach_any_count > 0 ? 'danger' : 'success'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="Reuse" value={`${breakdown.reused_count} · ${pct(breakdown.reused_ratio)}`} helper="Chain-risk impact" tone={breakdown.reused_count > 0 ? 'warning' : 'success'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="Stale records" value={`${breakdown.stale_count} · ${pct(breakdown.stale_ratio)}`} helper="Passwords older than 90 days" tone={breakdown.stale_count > 0 ? 'warning' : 'success'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="TOTP coverage" value={`${breakdown.totp_enabled_count} · ${pct(breakdown.totp_ratio)}`} helper="Positive score bonus" tone={breakdown.totp_enabled_count > 0 ? 'info' : 'default'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="Uniqueness bonus" value={`+${breakdown.bonus_unique ?? 0}`} helper={`Total bonus: +${breakdown.bonus_total ?? 0}`} tone={(breakdown.bonus_total ?? 0) > 0 ? 'success' : 'default'} />
            </Grid>
          </Grid>
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <SectionCard eyebrow="Time" title="Score history" action={<Chip size="small" icon={<TrendingUpRoundedIcon />} label={`${history.length} measurements`} variant="outlined" />}>
          {history.length < 2 ? (
            <Typography color="text.secondary">At least two measurements are required for the chart.</Typography>
          ) : (
            <Line data={historyChartData} options={scoreChartOptions} />
          )}
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <SectionCard eyebrow="Trend" title="Password health summary">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {trendText(healthTrend?.summary)}
          </Typography>
          <Stack spacing={1.25}>
            <MetricTile label="Score change" value={healthTrend?.summary?.score_delta ?? 0} helper="Difference between the first and last snapshot" tone={(healthTrend?.summary?.score_delta ?? 0) >= 0 ? 'success' : 'danger'} />
            <MetricTile label="Weak password delta" value={healthTrend?.summary?.weak_delta ?? 0} helper="A negative value indicates improvement" tone={(healthTrend?.summary?.weak_delta ?? 0) <= 0 ? 'success' : 'warning'} />
            <MetricTile label="Breach delta" value={healthTrend?.summary?.breach_delta ?? 0} helper="Change in open breach load" tone={(healthTrend?.summary?.breach_delta ?? 0) <= 0 ? 'success' : 'danger'} />
          </Stack>
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <SectionCard eyebrow="Health" title="Password health trend">
          {healthPoints.length < 2 ? (
            <Typography color="text.secondary">At least two snapshots are required for the trend chart.</Typography>
          ) : (
            <Line data={healthChartData} options={countChartOptions} />
          )}
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <SectionCard eyebrow="Category" title="Health by category">
          {catStats.every(item => item.total === 0) ? (
            <Typography color="text.secondary">No records yet.</Typography>
          ) : (
            <Bar data={categoryChartData} options={countChartOptions} />
          )}
        </SectionCard>
      </Grid>
    </Grid>
  )
}

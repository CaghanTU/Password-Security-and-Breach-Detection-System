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

const CAT_LABELS = { email: 'E-posta', banking: 'Bankacılık', social: 'Sosyal', work: 'İş', other: 'Diğer' }
function pct(value) {
  return `${Math.round((value || 0) * 100)}%`
}

function bandText(band) {
  return {
    excellent: 'çok iyi',
    good: 'iyi',
    watch: 'izlenmeli',
    critical: 'kritik',
  }[band] ?? band
}

function trendText(summary) {
  if (!summary) return 'Trend verisi hazırlanıyor.'
  if (summary.trend_direction === 'improving') return 'Parola sağlığı iyileşiyor.'
  if (summary.trend_direction === 'declining') return 'Son snapshotlara göre risk baskısı yükseliyor.'
  if (summary.trend_direction === 'stable') return 'Son snapshotlarda belirgin değişim yok.'
  return 'Trend için daha fazla ölçüm gerekiyor.'
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
    labels: history.map(item => new Date(item.calculated_at).toLocaleDateString('tr-TR')),
    datasets: [{
      label: 'Risk skoru',
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
    labels: healthPoints.map(point => new Date(point.created_at).toLocaleDateString('tr-TR')),
    datasets: [
      { label: 'Zayıf', data: healthPoints.map(point => point.weak_count), borderColor: '#ff6b5a', backgroundColor: 'rgba(255, 107, 90, 0.12)', tension: 0.3 },
      { label: 'İhlalli', data: healthPoints.map(point => point.breach_any_count), borderColor: '#f0a847', backgroundColor: 'rgba(240, 168, 71, 0.12)', tension: 0.3 },
      { label: 'Eski', data: healthPoints.map(point => point.stale_count), borderColor: '#ffd166', backgroundColor: 'rgba(255, 209, 102, 0.12)', tension: 0.3 },
      { label: 'Tekrar', data: healthPoints.map(point => point.reused_count), borderColor: '#67b7ff', backgroundColor: 'rgba(103, 183, 255, 0.12)', tension: 0.3 },
    ],
  }

  const categoryChartData = {
    labels: catStats.filter(item => item.total > 0).map(item => CAT_LABELS[item.category] ?? item.category),
    datasets: [
      { label: 'Zayıf', data: catStats.filter(item => item.total > 0).map(item => item.weak), backgroundColor: 'rgba(255, 107, 90, 0.8)' },
      { label: 'İhlalli', data: catStats.filter(item => item.total > 0).map(item => item.breached), backgroundColor: 'rgba(240, 168, 71, 0.8)' },
      { label: 'Eski', data: catStats.filter(item => item.total > 0).map(item => item.stale), backgroundColor: 'rgba(103, 183, 255, 0.8)' },
    ],
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12 }}>
        <AIAdvisorCard
          title="Risk Özeti"
          eyebrow="Akıllı Yorum"
          data={aiInsights?.briefing ?? null}
          loading={aiLoading}
          error={aiError}
          onRefresh={loadAIOnly}
        />
      </Grid>

      {aiInsights && (
        <>
          <Grid size={{ xs: 12, lg: 6 }}>
            <SectionCard eyebrow="Haftalık" title={aiInsights.weekly_summary.headline}>
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
                      İzleme {index + 1}
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
            <SectionCard eyebrow="What-if" title="Senaryo Simülatörü">
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
          <SectionCard eyebrow="48 Saat" title="48 Saatlik Müdahale Planı">
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
                    <Chip size="small" label={`Skor bandı: ${bandText(breakdown.score_band)}`} color="primary" variant="outlined" />
                  </Stack>
                  <Typography variant="h4">
                    Güvenlik duruşun şu an {data.score >= 70 ? 'iyi yönde' : data.score >= 45 ? 'takip gerektiriyor' : 'kritik baskı altında'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                    Skor; zayıf parola, ihlal, tekrar kullanım, stale kayıt ve TOTP bonusunun birleşiminden oluşur. Etkiler bağımsızdır, doğrudan toplanmaz.
                  </Typography>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, lg: 3 }}>
                <Box sx={{ textAlign: { xs: 'left', lg: 'center' } }}>
                  <Typography sx={{ fontSize: { xs: '4.5rem', md: '5.5rem' }, lineHeight: 1, fontWeight: 900, color: scoreTone }}>
                    {data.score}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">100 üzerinden anlık güvenlik skoru</Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, lg: 5 }}>
                <Stack spacing={1.25}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                    <Button fullWidth variant="contained" startIcon={<RefreshRoundedIcon />} onClick={load}>
                      Yeniden hesapla
                    </Button>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="secondary"
                      startIcon={pdfLoading ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                      onClick={handleDownloadPDF}
                      disabled={pdfLoading}
                    >
                      PDF raporu indir
                    </Button>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                    Skor, plan ve simülasyon alanları doğrudan risk modelinden hesaplanır; akıllı yorum katmanı bu verileri daha anlaşılır şekilde açıklar.
                  </Typography>
                  {pdfErr && <Alert severity="error">{pdfErr}</Alert>}
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <SectionCard eyebrow="Özet" title="Risk bileşenleri">
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="Zayıf parola" value={`${breakdown.weak_count} · ${pct(breakdown.weak_ratio)}`} helper="Doğrudan ağır ceza kalemi" tone={breakdown.weak_count > 0 ? 'danger' : 'success'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="İhlalli kayıt" value={`${breakdown.breach_any_count} · ${pct(breakdown.breach_any_ratio)}`} helper="Breach baskısı" tone={breakdown.breach_any_count > 0 ? 'danger' : 'success'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="Tekrar kullanım" value={`${breakdown.reused_count} · ${pct(breakdown.reused_ratio)}`} helper="Zincir risk etkisi" tone={breakdown.reused_count > 0 ? 'warning' : 'success'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="Stale kayıt" value={`${breakdown.stale_count} · ${pct(breakdown.stale_ratio)}`} helper="90 gün üzeri parolalar" tone={breakdown.stale_count > 0 ? 'warning' : 'success'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="TOTP kapsaması" value={`${breakdown.totp_enabled_count} · ${pct(breakdown.totp_ratio)}`} helper="Pozitif skor bonusu" tone={breakdown.totp_enabled_count > 0 ? 'info' : 'default'} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MetricTile label="Benzersizlik bonusu" value={`+${breakdown.bonus_unique ?? 0}`} helper={`Toplam bonus: +${breakdown.bonus_total ?? 0}`} tone={(breakdown.bonus_total ?? 0) > 0 ? 'success' : 'default'} />
            </Grid>
          </Grid>
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <SectionCard eyebrow="Zaman" title="Skor geçmişi" action={<Chip size="small" icon={<TrendingUpRoundedIcon />} label={`${history.length} ölçüm`} variant="outlined" />}>
          {history.length < 2 ? (
            <Typography color="text.secondary">Grafik için en az iki ölçüm gerekli.</Typography>
          ) : (
            <Line data={historyChartData} options={scoreChartOptions} />
          )}
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <SectionCard eyebrow="Trend" title="Parola sağlık özeti">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {trendText(healthTrend?.summary)}
          </Typography>
          <Stack spacing={1.25}>
            <MetricTile label="Skor değişimi" value={healthTrend?.summary?.score_delta ?? 0} helper="İlk snapshot ile son snapshot arasındaki fark" tone={(healthTrend?.summary?.score_delta ?? 0) >= 0 ? 'success' : 'danger'} />
            <MetricTile label="Zayıf parola farkı" value={healthTrend?.summary?.weak_delta ?? 0} helper="Negatif değer iyileşme gösterir" tone={(healthTrend?.summary?.weak_delta ?? 0) <= 0 ? 'success' : 'warning'} />
            <MetricTile label="İhlal farkı" value={healthTrend?.summary?.breach_delta ?? 0} helper="Açık ihlal yükü değişimi" tone={(healthTrend?.summary?.breach_delta ?? 0) <= 0 ? 'success' : 'danger'} />
          </Stack>
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <SectionCard eyebrow="Sağlık" title="Parola sağlık trendi">
          {healthPoints.length < 2 ? (
            <Typography color="text.secondary">Trend grafiği için en az iki snapshot gerekli.</Typography>
          ) : (
            <Line data={healthChartData} options={countChartOptions} />
          )}
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <SectionCard eyebrow="Kategori" title="Kategori bazlı sağlık">
          {catStats.every(item => item.total === 0) ? (
            <Typography color="text.secondary">Henüz kayıt yok.</Typography>
          ) : (
            <Bar data={categoryChartData} options={countChartOptions} />
          )}
        </SectionCard>
      </Grid>
    </Grid>
  )
}

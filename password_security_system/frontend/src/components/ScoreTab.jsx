import { useState, useEffect, useCallback } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, Tooltip, Legend, Filler,
} from 'chart.js'
import { api } from '../services/api'
import {
  Box, Card, CardContent, Typography, Button, CircularProgress,
  Table, TableBody, TableRow, TableCell, Grid, Alert,
} from '@mui/material'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

const CAT_LABELS = { email: 'E-posta', banking: 'Bankacılık', social: 'Sosyal', work: 'İş', other: 'Diğer' }

function ScoreCircle({ score }) {
  const color = score >= 70 ? 'success.main' : score >= 40 ? 'warning.main' : 'error.main'
  return (
    <Box sx={{ textAlign: 'center', fontSize: '5rem', fontWeight: 800, color }}>
      {score}
      <Typography variant="body1" color="text.secondary" fontWeight={400} mt={0.5}>/ 100</Typography>
    </Box>
  )
}

function pct(v) {
  return `${Math.round((v || 0) * 100)}%`
}

export default function ScoreTab() {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [catStats, setCatStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfErr, setPdfErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [scoreData, hist, cats] = await Promise.all([
        api.getScore(),
        api.getScoreHistory(),
        api.getScoreByCategory(),
      ])
      setData(scoreData)
      setHistory(hist)
      setCatStats(cats)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleDownloadPDF() {
    setPdfLoading(true); setPdfErr('')
    try {
      const blob = await api.downloadReport()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'risk_report.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setPdfErr(e.message)
    } finally {
      setPdfLoading(false)
    }
  }

  if (loading) return <Box sx={{ textAlign: 'center', py: 5 }}><CircularProgress /></Box>
  if (!data) return null

  const b = data.breakdown
  const chartData = {
    labels: history.map(h => new Date(h.calculated_at).toLocaleDateString('tr-TR')),
    datasets: [{
      label: 'Risk Skoru',
      data: history.map(h => h.score),
      borderColor: '#0d6efd',
      backgroundColor: 'rgba(13,110,253,0.12)',
      tension: 0.35,
      fill: true,
      pointRadius: 4,
    }],
  }
  const chartOpts = {
    responsive: true,
    scales: {
      y: { min: 0, max: 100, ticks: { color: '#adb5bd' }, grid: { color: '#2d3148' } },
      x: { ticks: { color: '#adb5bd' }, grid: { color: '#2d3148' } },
    },
    plugins: { legend: { labels: { color: '#adb5bd' } } },
  }

  const catChartData = {
    labels: catStats.filter(c => c.total > 0).map(c => CAT_LABELS[c.category] ?? c.category),
    datasets: [
      {
        label: 'Zayıf',
        data: catStats.filter(c => c.total > 0).map(c => c.weak),
        backgroundColor: 'rgba(211,47,47,0.7)',
      },
      {
        label: 'İhlal',
        data: catStats.filter(c => c.total > 0).map(c => c.breached),
        backgroundColor: 'rgba(230,81,0,0.7)',
      },
      {
        label: 'Eski',
        data: catStats.filter(c => c.total > 0).map(c => c.stale),
        backgroundColor: 'rgba(245,124,0,0.7)',
      },
    ],
  }
  const catChartOpts = {
    responsive: true,
    scales: {
      y: { ticks: { color: '#adb5bd', stepSize: 1 }, grid: { color: '#2d3148' } },
      x: { ticks: { color: '#adb5bd' }, grid: { color: '#2d3148' } },
    },
    plugins: { legend: { labels: { color: '#adb5bd' } } },
  }

  const rows = [
    { label: 'Model', value: b.model_version ?? 'v1', color: null },
    { label: 'Toplam kayıt', value: b.total_credentials, color: null },
    { label: 'Zayıf şifre', value: `${b.weak_count} (${pct(b.weak_ratio)})`, color: b.weak_count > 0 ? 'error.main' : null },
    { label: 'Orta seviye', value: `${b.medium_count ?? 0} (${pct(b.medium_ratio)})`, color: (b.medium_count ?? 0) > 0 ? 'warning.main' : null },
    { label: 'Tekrar kullanılan', value: `${b.reused_count} (${pct(b.reused_ratio)})`, color: b.reused_count > 0 ? 'warning.main' : null },
    { label: 'Şifre ihlali', value: `${b.breached_count}`, color: b.breached_count > 0 ? 'error.main' : null },
    { label: 'E-posta ihlali', value: `${b.email_breached_count}`, color: b.email_breached_count > 0 ? 'error.main' : null },
    { label: 'Toplam ihlalli kayıt', value: `${b.breach_any_count ?? 0} (${pct(b.breach_any_ratio)})`, color: (b.breach_any_count ?? 0) > 0 ? 'error.main' : null },
    { label: 'Eski (>90 gün)', value: `${b.stale_count} (${pct(b.stale_ratio)})`, color: b.stale_count > 0 ? 'warning.main' : null },
    { label: 'İhlal sonrası güncellenmedi', value: `${b.not_rotated_count} (${pct(b.not_rotated_ratio)})`, color: b.not_rotated_count > 0 ? 'error.main' : null },
    { label: 'TOTP aktif kayıt', value: `${b.totp_enabled_count ?? 0} (${pct(b.totp_ratio)})`, color: (b.totp_enabled_count ?? 0) > 0 ? 'info.main' : null },
    { label: 'Temel skor', value: `${b.base_score ?? data.score}`, color: null },
    { label: 'Bonus (TOTP + Benzersizlik)', value: `+${b.bonus_total ?? 0}`, color: (b.bonus_total ?? 0) > 0 ? 'success.main' : null },
  ]

  return (
    <Grid container spacing={3}>
      {/* Score + breakdown */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 3 }}>
            <Typography variant="h6" mb={2}>Anlık Skor</Typography>
            <ScoreCircle score={data.score} />
            <Table size="small" sx={{ mt: 3 }}>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.label}>
                    <TableCell sx={{ color: r.color ?? 'text.primary', border: 0, py: 0.5 }}>{r.label}</TableCell>
                    <TableCell sx={{ color: r.color ?? 'text.primary', border: 0, py: 0.5 }}>{r.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button variant="outlined" color="info" size="small" fullWidth sx={{ mt: 2 }} onClick={load}>
              Yeniden Hesapla
            </Button>
            <Button
              variant="outlined" color="error" size="small" fullWidth sx={{ mt: 1 }}
              startIcon={pdfLoading ? <CircularProgress size={14} /> : <PictureAsPdfIcon />}
              onClick={handleDownloadPDF} disabled={pdfLoading}
            >
              PDF Raporu İndir
            </Button>
            {pdfErr && <Alert severity="error" sx={{ mt: 1 }}>{pdfErr}</Alert>}
          </CardContent>
        </Card>
      </Grid>

      {/* History chart */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Skor Geçmişi</Typography>
            {history.length < 2
              ? <Typography color="text.secondary">Grafik için en az 2 ölçüm gerekli.</Typography>
              : <Line data={chartData} options={chartOpts} />
            }
          </CardContent>
        </Card>

        {/* Category health chart */}
        <Card sx={{ mt: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Kategori Bazlı Sağlık</Typography>
            {catStats.every(c => c.total === 0) ? (
              <Typography color="text.secondary">Henüz kayıt yok.</Typography>
            ) : (
              <Bar data={catChartData} options={catChartOpts} />
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

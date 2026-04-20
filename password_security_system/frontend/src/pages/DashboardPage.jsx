import { useMemo, useState, useEffect } from 'react'
import {
  Alert, Box, Button, Chip, Container, Paper, Stack, Tab, Tabs, Typography,
} from '@mui/material'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded'
import PasswordRoundedIcon from '@mui/icons-material/PasswordRounded'
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ActionCenterTab from '../components/ActionCenterTab'
import PasswordsTab from '../components/PasswordsTab'
import BreachTab from '../components/BreachTab'
import GeneratorTab from '../components/GeneratorTab'
import ScoreTab from '../components/ScoreTab'
import ExportTab from '../components/ExportTab'
import AuditTab from '../components/AuditTab'
import TwoFATab from '../components/TwoFATab'
import { useAuth } from '../context/auth-context'
import { api } from '../services/api'

const TABS = [
  { id: 'actions', label: 'Aksiyon', title: 'Öncelikli güvenlik işleri', description: 'En kritik açıkları önce kapatmak için sıralanmış iş listesi.', icon: TrackChangesRoundedIcon, Component: ActionCenterTab },
  { id: 'passwords', label: 'Kasa', title: 'Parola kasası', description: 'Kayıtları düzenle, ihlalleri incele ve ilgili hesabı doğrudan güncelle.', icon: PasswordRoundedIcon, Component: PasswordsTab },
  { id: 'breach', label: 'Tarama', title: 'İhlal taraması', description: 'E-posta ve parola için ihlal geçmişini ayrı ayrı kontrol et.', icon: TravelExploreRoundedIcon, Component: BreachTab },
  { id: 'generator', label: 'Üretici', title: 'Güçlü parola üretici', description: 'Daha uzun, daha benzersiz ve politikaya uygun parolalar oluştur.', icon: AutoAwesomeRoundedIcon, Component: GeneratorTab },
  { id: 'score', label: 'Skor', title: 'Risk görünümü', description: 'Skorun neden bu seviyede olduğunu ve en hızlı iyileştirmeleri gör.', icon: InsightsRoundedIcon, Component: ScoreTab },
  { id: 'export', label: 'Aktarım', title: 'Veri aktarımı', description: 'İçe aktar, dışa aktar ve rapor akışlarını tek yerden yönet.', icon: FileDownloadRoundedIcon, Component: ExportTab },
  { id: 'audit', label: 'Denetim', title: 'İz kayıtları', description: 'Sistemde hangi aksiyonların ne zaman gerçekleştiğini takip et.', icon: FactCheckRoundedIcon, Component: AuditTab },
  { id: 'twofa', label: '2FA', title: 'İkinci faktör merkezi', description: 'Authenticator ve recovery code akışlarını güvenli biçimde yönet.', icon: VerifiedUserRoundedIcon, Component: TwoFATab },
]

function HeroMetric({ label, value, tone = 'default' }) {
  const color = {
    score: 'primary.main',
    danger: 'error.main',
    warning: 'warning.main',
    info: 'info.main',
    default: 'text.primary',
  }[tone] ?? 'text.primary'

  return (
    <Box
      sx={{
        minWidth: 150,
        px: 2,
        py: 1.5,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.03)',
      }}
    >
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" color={color}>{value}</Typography>
    </Box>
  )
}

export default function DashboardPage() {
  const { logout } = useAuth()
  const [active, setActive] = useState(0)
  const [navigationTarget, setNavigationTarget] = useState(null)
  const [scoreWarning, setScoreWarning] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [alertsDismissed, setAlertsDismissed] = useState(false)
  const [heroStats, setHeroStats] = useState({
    score: '—',
    critical: 0,
    openActions: 0,
    unresolvedCases: 0,
  })

  const activeTab = useMemo(() => TABS[active] ?? TABS[0], [active])
  const ActiveComponent = activeTab.Component

  function navigateToTab(tabId, options = {}) {
    const nextIndex = TABS.findIndex(tab => tab.id === tabId)
    if (nextIndex >= 0) {
      setActive(nextIndex)
      setNavigationTarget({ tabId, ...options, nonce: Date.now() })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    Promise.allSettled([api.getScore(), api.getAlerts(), api.getActionCenter()]).then(([scoreRes, alertsRes, actionsRes]) => {
      if (scoreRes.status === 'fulfilled') {
        const bd = scoreRes.value.breakdown
        const critical = bd.weak_count + bd.breach_any_count + bd.not_rotated_count
        if (critical > 0) setScoreWarning({ critical })
        setHeroStats(prev => ({
          ...prev,
          score: scoreRes.value.score,
          critical,
        }))
      }

      if (alertsRes.status === 'fulfilled' && alertsRes.value.unread_count > 0) {
        setAlerts(alertsRes.value.alerts)
      }

      if (actionsRes.status === 'fulfilled') {
        setHeroStats(prev => ({
          ...prev,
          openActions: actionsRes.value.summary.open_actions,
          unresolvedCases: actionsRes.value.summary.unresolved_breach_cases,
        }))
      }
    })
  }, [])

  async function dismissAlerts() {
    try {
      await api.markAlertsRead()
    } finally {
      setAlertsDismissed(true)
    }
  }

  return (
    <Box sx={{ position: 'relative', minHeight: '100vh', pb: 6 }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(circle at top left, rgba(99, 216, 204, 0.08), transparent 25%), radial-gradient(circle at right 15%, rgba(241, 191, 102, 0.07), transparent 20%)',
        }}
      />

      <Container maxWidth="xl" sx={{ position: 'relative', px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 } }}>
        <Paper
          sx={{
            mb: 3,
            p: { xs: 2.25, md: 3.5 },
            borderRadius: 6,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(16, 28, 36, 0.98) 0%, rgba(10, 18, 24, 0.96) 56%, rgba(18, 39, 40, 0.98) 100%)',
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={3}>
            <Box sx={{ maxWidth: 760 }}>
              <Stack direction="row" alignItems="center" spacing={1.25} mb={1.5}>
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
                <Chip size="small" label="Security Operations" color="primary" variant="outlined" />
              </Stack>
              <Typography variant="h3" sx={{ mb: 1.25 }}>
                Password Security System
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 680, lineHeight: 1.7 }}>
                Parolaları sadece saklayan bir kasa değil; ihlali, tekrar kullanımı, 2FA durumunu ve risk skorunu aynı panelde yöneten bir güvenlik çalışma alanı.
              </Typography>
            </Box>

            <Stack alignItems={{ xs: 'stretch', lg: 'flex-end' }} spacing={1.25}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<LogoutRoundedIcon />}
                onClick={logout}
                sx={{ alignSelf: { xs: 'stretch', lg: 'flex-end' } }}
              >
                Oturumu Kapat
              </Button>
              <Typography variant="caption" color="text.secondary">
                Aktif görünüm: {activeTab.title}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} mt={3} flexWrap="wrap">
            <HeroMetric label="Anlık skor" value={heroStats.score} tone="score" />
            <HeroMetric label="Kritik bulgu" value={heroStats.critical} tone="danger" />
            <HeroMetric label="Açık aksiyon" value={heroStats.openActions} tone="warning" />
            <HeroMetric label="Açık takip vakası" value={heroStats.unresolvedCases} tone="info" />
          </Stack>

          <Stack spacing={1.5} mt={3}>
            {alerts.length > 0 && !alertsDismissed && (
              <Alert
                severity="error"
                icon={<NotificationsActiveIcon />}
                action={<Button color="error" size="small" onClick={dismissAlerts}>Okundu</Button>}
              >
                <strong>{alerts.length} yeni ihlal bildirimi:</strong> {alerts[0].message}
                {alerts.length > 1 ? ` ve ${alerts.length - 1} diğer kayıt.` : ''}
              </Alert>
            )}

            {scoreWarning && (
              <Alert
                severity="warning"
                icon={<WarningAmberRoundedIcon />}
                onClose={() => setScoreWarning(null)}
              >
                {scoreWarning.critical} önemli risk kalemi tespit edildi. Önce Aksiyon veya Skor sekmesinden başlayın.
              </Alert>
            )}
          </Stack>

          <Tabs
            value={active}
            onChange={(_, nextValue) => {
              setActive(nextValue)
              setNavigationTarget(null)
            }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mt: 3 }}
          >
            {TABS.map(tab => {
              const Icon = tab.icon
              return <Tab key={tab.id} icon={<Icon fontSize="small" />} iconPosition="start" label={tab.label} />
            })}
          </Tabs>
        </Paper>

        <Box sx={{ mb: 2.5 }}>
          <Typography variant="overline" sx={{ color: 'primary.light', letterSpacing: '0.12em' }}>
            {activeTab.label}
          </Typography>
          <Typography variant="h5" sx={{ mt: 0.25 }}>
            {activeTab.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
            {activeTab.description}
          </Typography>
        </Box>

        {ActiveComponent && (
          <ActiveComponent
            onNavigateTab={navigateToTab}
            navigationTarget={navigationTarget}
          />
        )}
      </Container>
    </Box>
  )
}

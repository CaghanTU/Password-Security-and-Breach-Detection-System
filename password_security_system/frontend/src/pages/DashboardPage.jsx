import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Box, AppBar, Toolbar, Typography, Button, Tabs, Tab, Container, Alert } from '@mui/material'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import PasswordsTab from '../components/PasswordsTab'
import BreachTab from '../components/BreachTab'
import GeneratorTab from '../components/GeneratorTab'
import ScoreTab from '../components/ScoreTab'
import ExportTab from '../components/ExportTab'
import AuditTab from '../components/AuditTab'
import TwoFATab from '../components/TwoFATab'
import { api } from '../services/api'

const TABS = [
  { id: 'passwords',  label: '🗝 Şifreler',        Component: PasswordsTab  },
  { id: 'breach',     label: '🔍 İhlal Tarayıcı',  Component: BreachTab     },
  { id: 'generator',  label: '⚡ Üretici',          Component: GeneratorTab  },
  { id: 'score',      label: '📊 Risk Skoru',       Component: ScoreTab      },
  { id: 'export',     label: '🔗 Veri Köprüsü',     Component: ExportTab     },
  { id: 'audit',      label: '📋 Audit Log',        Component: AuditTab      },
  { id: 'twofa',      label: '🛡 2FA',              Component: TwoFATab      },
]

export default function DashboardPage() {
  const { logout } = useAuth()
  const [active, setActive] = useState(0)
  const [scoreWarning, setScoreWarning] = useState(null)   // { critical: N }
  const [alerts, setAlerts] = useState([])
  const [alertsDismissed, setAlertsDismissed] = useState(false)

  const ActiveComponent = TABS[active]?.Component

  useEffect(() => {
    // Load risk score for weak-password banner
    api.getScore().then(data => {
      const bd = data.breakdown
      const critical = bd.weak_count + bd.breached_count + bd.email_breached_count
      if (critical > 0) setScoreWarning({ critical })
    }).catch(() => {})

    // Load unread breach alerts
    api.getAlerts().then(data => {
      if (data.unread_count > 0) setAlerts(data.alerts)
    }).catch(() => {})
  }, [])

  async function dismissAlerts() {
    try { await api.markAlertsRead() } catch (_) {}
    setAlertsDismissed(true)
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight={700} color="primary">
            🔐 Password Security System
          </Typography>
          <Button variant="outlined" color="error" size="small" onClick={logout}>Çıkış</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ px: 4, py: 3 }}>
        {/* Breach alert banner */}
        {alerts.length > 0 && !alertsDismissed && (
          <Alert
            severity="error"
            icon={<NotificationsActiveIcon />}
            sx={{ mb: 2 }}
            action={<Button color="error" size="small" onClick={dismissAlerts}>Gördüm</Button>}
          >
            <strong>{alerts.length} yeni ihlal bildirimi:</strong>{' '}
            {alerts[0].message}{alerts.length > 1 ? ` ve ${alerts.length - 1} diğer.` : ''}
          </Alert>
        )}

        {/* Weak password warning */}
        {scoreWarning && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            onClose={() => setScoreWarning(null)}
          >
            {scoreWarning.critical} kritik güvenlik sorunu tespit edildi. Risk Skoru sekmesini inceleyin.
          </Alert>
        )}

        <Tabs
          value={active}
          onChange={(_, v) => setActive(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          {TABS.map(t => <Tab key={t.id} label={t.label} />)}
        </Tabs>

        {ActiveComponent && <ActiveComponent />}
      </Container>
    </Box>
  )
}

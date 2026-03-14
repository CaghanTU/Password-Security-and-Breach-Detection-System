import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import PasswordsTab from '../components/PasswordsTab'
import BreachTab from '../components/BreachTab'
import GeneratorTab from '../components/GeneratorTab'
import ScoreTab from '../components/ScoreTab'
import ExportTab from '../components/ExportTab'
import AuditTab from '../components/AuditTab'
import TwoFATab from '../components/TwoFATab'

const TABS = [
  { id: 'passwords',  label: 'Passwords',        Component: PasswordsTab  },
  { id: 'breach',     label: 'Breach Scanner',    Component: BreachTab     },
  { id: 'generator',  label: 'Generator',         Component: GeneratorTab  },
  { id: 'score',      label: 'Risk Score',        Component: ScoreTab      },
  { id: 'export',     label: 'Backup',            Component: ExportTab     },
  { id: 'audit',      label: 'Audit Log',         Component: AuditTab      },
  { id: 'twofa',      label: '2FA',               Component: TwoFATab      },
]

export default function DashboardPage() {
  const { logout } = useAuth()
  const [active, setActive] = useState('passwords')

  const ActiveComponent = TABS.find(t => t.id === active)?.Component

  return (
    <div className="min-vh-100">
      {/* Navbar */}
      <nav className="navbar navbar-dark px-4 py-3" style={{ background: '#0a0c12', borderBottom: '1px solid #2d3148' }}>
        <span className="navbar-brand-logo text-primary">Password Security System</span>
        <button className="btn btn-sm btn-outline-danger" onClick={logout}>Log Out</button>
      </nav>

      <div className="container-fluid px-4 py-3">
        {/* Tab nav */}
        <ul className="nav nav-tabs mb-4" style={{ borderBottom: '1px solid #2d3148' }}>
          {TABS.map(t => (
            <li className="nav-item" key={t.id}>
              <button
                className={`nav-link ${active === t.id ? 'active fw-semibold' : 'text-secondary'}`}
                style={active === t.id ? { borderBottom: '2px solid #0d6efd', color: '#6ea8fe' } : {}}
                onClick={() => setActive(t.id)}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Active tab */}
        <div className="tab-pane">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </div>
  )
}

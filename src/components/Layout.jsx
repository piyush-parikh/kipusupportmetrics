import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../lib/useAuth'

const NAV = [
  {
    group: 'Performance',
    items: [
      { label: 'Agent Performance', to: '/' },
      { label: 'Team Dashboard', to: '/team-dashboard' },
    ],
  },
  {
    group: 'Attendance',
    items: [
      { label: 'Attendance Summary', to: '/attendance' },
      { label: 'Attendance Entry', to: '/attendance/entry' },
      { label: 'Attendance Codes', to: '/admin/attendance-codes' },
    ],
  },
  {
    group: 'People & Assignment',
    items: [
      { label: 'Agents', to: '/admin/agents' },
      { label: 'Teams', to: '/admin/teams' },
      { label: 'Team Assignments', to: '/admin/team-assignments' },
    ],
  },
  {
    group: 'Metric Setup',
    items: [
      { label: 'Metrics', to: '/admin/metrics' },
      { label: 'Goals', to: '/admin/goals' },
      { label: 'Notes', to: '/admin/notes' },
    ],
  },
  {
    group: 'Support',
    items: [
      { label: 'Help & Playbook', to: '/help' },
    ],
  },
]

const PROD_HOST = 'kipusupportmetrics.vercel.app'
const isStaging = typeof window !== 'undefined' && window.location.hostname !== PROD_HOST && window.location.hostname !== 'localhost'

function getSidebarPref() {
  try { return localStorage.getItem('ktp_sidebar') !== 'closed' } catch { return true }
}

export default function Layout({ children }) {
  const [open, setOpen] = useState(getSidebarPref)
  // APT-149: the menu itself is identical for everyone — only the footer
  // below says who is signed in and what they can do.
  const { email, isAdmin, signOut } = useAuth()

  function toggle() {
    const next = !open
    setOpen(next)
    try { localStorage.setItem('ktp_sidebar', next ? 'open' : 'closed') } catch {}
  }

  return (
    <div className="app-shell">
      {isStaging && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#f59e0b', color: '#1a1a2e', textAlign: 'center', fontSize: 12, fontWeight: 700, padding: '4px 0', letterSpacing: 0.5 }}>
          STAGING — {window.location.hostname}
        </div>
      )}
      <nav className={`sidebar${open ? '' : ' sidebar-collapsed'}`} style={isStaging ? { paddingTop: 26 } : undefined}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: open ? 'space-between' : 'center' }}>
            {open && <div>Kipu Tracker<span>Support Performance · {isStaging ? 'Staging' : 'Live'}</span></div>}
            <button className="sidebar-toggle" onClick={toggle} title={open ? 'Collapse' : 'Expand'}>
              {open ? '◀' : '▶'}
            </button>
          </div>
        </div>
        {open && (
          <div className="sidebar-nav">
            {NAV.map((section) => (
              <div className="nav-group" key={section.group}>
                <div className="nav-label">{section.group}</div>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/' || item.to === '/attendance'}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        )}
        {open && (
          <div className="sidebar-user">
            <span className="sidebar-user-email" title={email}>{email}</span>
            <span className="sidebar-user-role">{isAdmin ? 'Admin' : 'User'}</span>
            <div>
              <button className="sidebar-signout" onClick={signOut}>Sign out</button>
            </div>
          </div>
        )}
      </nav>
      <main className="main-content" style={isStaging ? { paddingTop: 26 } : undefined}>
        {children}
      </main>
    </div>
  )
}

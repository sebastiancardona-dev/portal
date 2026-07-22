import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Boxes,
  Check,
  Clock,
  LayoutDashboard,
  LogOut,
  Moon,
  Pencil,
  Rss,
  Search,
  Server,
  Settings,
  Sun,
  Users,
} from 'lucide-react'
import { logout } from '../api/client'
import { currentTheme, toggleTheme } from '../theme/theme'
import { useApps, useMe } from '../api/hooks'
import { appStatusState, StatusDot } from '../ui'
import { CommandPalette } from './CommandPalette'
import { DashboardChromeProvider, useDashboardChrome } from './DashboardChrome'
import { Pulse } from './Pulse'

const ICON = { size: 16, strokeWidth: 1.75 } as const

function EditLayoutControls() {
  const { onDashboard, editing, dirty, saving, setEditing } = useDashboardChrome()
  if (!onDashboard) return null
  return (
    <div className="edit-controls">
      {editing && (
        <span className={`save-state${dirty && !saving ? ' unsaved' : ''}`}>
          {saving ? 'saving…' : dirty ? 'unsaved changes' : 'saved'}
        </span>
      )}
      <button type="button" className={`btn btn-sm${editing ? ' btn-primary' : ''}`} onClick={() => setEditing(!editing)}>
        {editing ? <Check {...ICON} /> : <Pencil size={14} strokeWidth={1.75} />}
        {editing ? 'Done editing' : 'Edit layout'}
      </button>
    </div>
  )
}

/** Planned modules (none right now — project 08 closed the list). The shell
 *  keeps the affordance so future plans can read as a console being built out. */
const PLANNED_MODULES: { icon: typeof Clock; label: string }[] = []

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform)

function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme)
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm btn-icon"
      onClick={() => setTheme(toggleTheme())}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Sun {...ICON} aria-hidden="true" /> : <Moon {...ICON} aria-hidden="true" />}
    </button>
  )
}

export function AppShell() {
  const apps = useApps()
  const me = useMe()
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <DashboardChromeProvider>
      <div className="shell">
        <aside className="sidebar">
          <NavLink to="/" className="brand" title="Portal — dashboard">
            <span className="brand-name">Portal</span>
            <span className="brand-domain">sebastiancardona.dev</span>
          </NavLink>

          <nav className="nav" aria-label="Primary">
            <span className="nav-section">Observe</span>
            <NavLink to="/" end title="Dashboard">
              <LayoutDashboard {...ICON} aria-hidden="true" />
              <span className="nav-label">Dashboard</span>
            </NavLink>
            <NavLink to="/apps" end title="Apps">
              <Boxes {...ICON} aria-hidden="true" />
              <span className="nav-label">Apps</span>
            </NavLink>
            <NavLink to="/host" title="Host">
              <Server {...ICON} aria-hidden="true" />
              <span className="nav-label">Host</span>
            </NavLink>

            <span className="nav-section">Apps</span>
            {apps.isPending && <span className="nav-quiet">discovering…</span>}
            {apps.data?.length === 0 && <span className="nav-quiet">none discovered yet</span>}
            {apps.data?.map((app) => (
              <NavLink key={app.app} to={`/apps/${app.app}`} title={app.displayName || app.app}>
                <StatusDot state={appStatusState(app.environments)} />
                <span className="nav-label nav-app">{app.displayName || app.app}</span>
              </NavLink>
            ))}

            <span className="nav-section">Modules</span>
            {me.data?.role === 'admin' && (
              <>
                <NavLink to="/logs" title="Logs — every container, filters + DQL">
                  <Rss {...ICON} aria-hidden="true" />
                  <span className="nav-label">Logs</span>
                </NavLink>
                <NavLink to="/accounts" title="Accounts — SSO users, invites, audit">
                  <Users {...ICON} aria-hidden="true" />
                  <span className="nav-label">Accounts</span>
                </NavLink>
              </>
            )}
            <NavLink to="/releases" title="Releases — versions, deploys, artifacts">
              <Clock {...ICON} aria-hidden="true" />
              <span className="nav-label">Releases</span>
            </NavLink>
            {PLANNED_MODULES.map((m) => (
              <div key={m.label} className="nav-row nav-module" title={`${m.label} — planned module`}>
                <m.icon {...ICON} aria-hidden="true" />
                <span className="nav-label">{m.label}</span>
                <span className="soon-tag">soon</span>
              </div>
            ))}

            <span className="nav-section">Configure</span>
            <NavLink to="/settings" title="Settings">
              <Settings {...ICON} aria-hidden="true" />
              <span className="nav-label">Settings</span>
            </NavLink>
          </nav>

          <div className="sidebar-foot">read-only by construction</div>
        </aside>

        <div className="shell-main">
          <header className="topbar">
            <Pulse />
            <button
              type="button"
              className="search-btn"
              onClick={() => setPaletteOpen(true)}
              aria-haspopup="dialog"
            >
              <Search {...ICON} aria-hidden="true" />
              <span className="search-hint">Search</span>
              <kbd>{IS_MAC ? 'Cmd K' : 'Ctrl K'}</kbd>
            </button>
            <div className="topbar-spacer" />
            <EditLayoutControls />
            <span className="topbar-user" title={me.data ? `${me.data.name} · ${me.data.role}` : undefined}>
              {me.data?.email ?? ''}
            </span>
            <ThemeToggle />
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => logout()}
              title="Log out"
              aria-label="Log out"
            >
              <LogOut {...ICON} aria-hidden="true" />
            </button>
          </header>
          <main className="content">
            <Outlet />
          </main>
        </div>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </DashboardChromeProvider>
  )
}

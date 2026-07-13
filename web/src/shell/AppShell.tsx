import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { logout } from '../api/client'
import { useApps, useMe } from '../api/hooks'
import { useTheme } from '../theme/ThemeContext'
import { appLedState, Led } from '../ui'
import { CommandPalette } from './CommandPalette'
import { DashboardChromeProvider, useDashboardChrome } from './DashboardChrome'
import { Pulse } from './Pulse'

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
      <button type="button" className={`btn${editing ? ' btn-primary' : ''}`} onClick={() => setEditing(!editing)}>
        {editing ? 'Done editing' : 'Edit layout'}
      </button>
    </div>
  )
}

/** The modules the ecosystem plan promises (projects 07/08/05) — the shell
 *  anticipates them so the sidebar reads as an instrument being built out. */
const PLANNED_MODULES = [
  { glyph: 'LG', label: 'Logs' },
  { glyph: 'VN', label: 'Versions' },
  { glyph: 'AC', label: 'Accounts' },
]

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform)

export function AppShell() {
  const apps = useApps()
  const me = useMe()
  const { mode, toggle } = useTheme()
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
            <span className="brand-name">PORTAL</span>
            <span className="brand-domain">sebastiancardona.dev</span>
          </NavLink>

          <nav className="nav" aria-label="Primary">
            <span className="nav-eyebrow">Observe</span>
            <NavLink to="/" end title="Dashboard">
              <span className="nav-glyph" aria-hidden="true">DA</span>
              <span className="nav-label">Dashboard</span>
            </NavLink>
            <NavLink to="/apps" end title="Apps">
              <span className="nav-glyph" aria-hidden="true">AP</span>
              <span className="nav-label">Apps</span>
            </NavLink>
            <NavLink to="/host" title="Host">
              <span className="nav-glyph" aria-hidden="true">HO</span>
              <span className="nav-label">Host</span>
            </NavLink>

            <span className="nav-eyebrow">Apps</span>
            {apps.isPending && <span className="nav-quiet">discovering…</span>}
            {apps.data?.length === 0 && <span className="nav-quiet">none discovered yet</span>}
            {apps.data?.map((app) => (
              <NavLink key={app.app} to={`/apps/${app.app}`} title={app.displayName || app.app}>
                <Led state={appLedState(app.environments)} />
                <span className="nav-label nav-app">{app.displayName || app.app}</span>
              </NavLink>
            ))}

            <span className="nav-eyebrow">Modules</span>
            {PLANNED_MODULES.map((m) => (
              <div key={m.label} className="nav-row nav-planned" title={`${m.label} — planned module`}>
                <span className="nav-glyph" aria-hidden="true">{m.glyph}</span>
                <span className="nav-label">{m.label}</span>
                <span className="planned-tag">planned</span>
              </div>
            ))}

            <span className="nav-eyebrow">Configure</span>
            <NavLink to="/settings" title="Settings">
              <span className="nav-glyph" aria-hidden="true">SE</span>
              <span className="nav-label">Settings</span>
            </NavLink>
          </nav>

          <div className="sidebar-foot">
            <span className="foot-copy">read-only by construction</span>
            <button
              type="button"
              className="btn btn-ghost theme-toggle"
              onClick={toggle}
              title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
            >
              {mode === 'dark' ? '☀' : '☾'}
            </button>
          </div>
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
              <span className="search-hint">Search…</span>
              <kbd>{IS_MAC ? '⌘K' : 'Ctrl+K'}</kbd>
            </button>
            <div className="topbar-spacer" />
            <EditLayoutControls />
            <span className="topbar-user" title={me.data ? `${me.data.name} · ${me.data.role}` : undefined}>
              {me.data?.email ?? ''}
            </span>
            <button type="button" className="btn btn-ghost" onClick={() => logout()}>
              Log out
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

import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { logout } from '../api/client'
import { useApps, useMe } from '../api/hooks'
import { useTheme } from '../theme/ThemeContext'
import { DashboardChromeProvider, useDashboardChrome } from './DashboardChrome'

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

function upDot(allUp: boolean | undefined) {
  if (allUp === undefined) return <span className="nav-dot" />
  return <span className={`nav-dot ${allUp ? 'nav-dot-up' : 'nav-dot-down'}`} />
}

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false)
  const apps = useApps()
  const me = useMe()
  const { mode, toggle } = useTheme()
  const closeNav = () => setNavOpen(false)

  return (
    <DashboardChromeProvider>
      <div className="shell">
        <aside className={`sidebar${navOpen ? ' open' : ''}`}>
          <NavLink to="/" className="brand" onClick={closeNav}>
            <span className="brand-mark" aria-hidden="true" />
            <span>Portal</span>
          </NavLink>
          <nav className="nav">
            <span className="nav-section">Overview</span>
            <NavLink to="/" end onClick={closeNav}>
              Dashboard
            </NavLink>
            <NavLink to="/apps" end onClick={closeNav}>
              Apps
            </NavLink>
            <NavLink to="/host" onClick={closeNav}>
              Host
            </NavLink>
            <span className="nav-section">Apps</span>
            {apps.isPending && <span className="nav-quiet">discovering…</span>}
            {apps.data?.length === 0 && <span className="nav-quiet">none discovered yet</span>}
            {apps.data?.map((app) => (
              <NavLink key={app.app} to={`/apps/${app.app}`} onClick={closeNav}>
                {upDot(app.environments.length ? app.environments.every((e) => e.up) : undefined)}
                {app.displayName || app.app}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-foot">read-only by construction</div>
        </aside>
        {navOpen && <div className="nav-scrim" onClick={closeNav} />}

        <div className="shell-main">
          <header className="topbar">
            <button
              type="button"
              className="btn nav-burger"
              onClick={() => setNavOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <div className="topbar-spacer" />
            <EditLayoutControls />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={toggle}
              title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
            >
              {mode === 'dark' ? '☀' : '☾'}
            </button>
            <span className="topbar-user mono" title={me.data ? `${me.data.name} · ${me.data.role}` : undefined}>
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
    </DashboardChromeProvider>
  )
}

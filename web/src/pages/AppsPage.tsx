import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApps } from '../api/hooks'
import type { AppSummary } from '../api/types'
import { fmtMs } from '../format'
import { appStatusState, EnvBadge, Quiet, RelTime, Skeleton, StatusDot, StatusPill } from '../ui'

export function AppIcon({ app }: { app: Pick<AppSummary, 'icon' | 'displayName' | 'app'> }) {
  if (app.icon && /^https?:\/\//.test(app.icon)) {
    return <img className="app-icon" src={app.icon} alt="" />
  }
  const glyph = app.icon || (app.displayName || app.app).charAt(0).toUpperCase()
  return (
    <span className="app-icon" aria-hidden="true">
      {glyph}
    </span>
  )
}

function lastDeployOf(app: AppSummary): string | null {
  const stamps = app.environments.map((e) => e.lastDeploy).filter(Boolean)
  if (stamps.length === 0) return null
  return stamps.reduce((a, b) => (a > b ? a : b))
}

export function AppsPage() {
  const apps = useApps()
  const [filter, setFilter] = useState('')

  if (apps.isPending) {
    return (
      <div className="card-grid">
        <Skeleton height={150} />
        <Skeleton height={150} />
        <Skeleton height={150} />
      </div>
    )
  }
  if (apps.isError) return <Quiet>could not load apps</Quiet>
  if (apps.data.length === 0) {
    return <Quiet>no apps discovered yet — deploy something and it will show up here</Quiet>
  }

  const q = filter.trim().toLowerCase()
  const visible = q
    ? apps.data.filter(
        (a) => (a.displayName || a.app).toLowerCase().includes(q) || a.app.toLowerCase().includes(q),
      )
    : apps.data

  return (
    <>
      <header className="page-head">
        <div className="page-id">
          <span className="eyebrow">Applications</span>
          <h1 className="page-title">Apps</h1>
        </div>
        <input
          className="filter-input"
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter apps…"
          aria-label="Filter apps"
        />
      </header>

      {visible.length === 0 ? (
        <Quiet>no app matches “{filter}”</Quiet>
      ) : (
        <div className="card-grid">
          {visible.map((app) => {
            const lastDeploy = lastDeployOf(app)
            return (
              <Link key={app.app} to={`/apps/${app.app}`} className="app-card">
                <div className="app-card-head">
                  <StatusDot state={appStatusState(app.environments)} />
                  <span className="app-card-name">{app.displayName || app.app}</span>
                  <span className="app-card-meta">
                    {app.containers.length} ctr{app.containers.length === 1 ? '' : 's'}
                  </span>
                </div>
                {app.environments.length === 0 ? (
                  <div className="quiet">no environments reported</div>
                ) : (
                  <div className="app-card-envs">
                    {app.environments.map((env) => (
                      <div key={env.env} className="app-card-env">
                        <EnvBadge env={env.env} />
                        <span className="app-card-version">{env.version || '—'}</span>
                        <span className="app-card-latency">{env.up ? fmtMs(env.latencyMs) : '—'}</span>
                        <StatusPill up={env.up} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="app-card-foot">
                  last deploy <RelTime ts={lastDeploy} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

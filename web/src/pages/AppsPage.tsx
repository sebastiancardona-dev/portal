import { Link } from 'react-router-dom'
import { useApps } from '../api/hooks'
import type { AppSummary } from '../api/types'
import { EnvBadge, Quiet, Skeleton, StatusPill } from '../ui'

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

export function AppsPage() {
  const apps = useApps()

  if (apps.isPending) {
    return (
      <div className="card-grid">
        <Skeleton height={140} />
        <Skeleton height={140} />
        <Skeleton height={140} />
      </div>
    )
  }
  if (apps.isError) return <Quiet>could not load apps</Quiet>
  if (apps.data.length === 0) {
    return <Quiet>no apps discovered yet — deploy something and it will show up here</Quiet>
  }

  return (
    <>
      <h1 className="page-title">Apps</h1>
      <div className="card-grid">
        {apps.data.map((app) => (
          <Link key={app.app} to={`/apps/${app.app}`} className="app-card">
            <div className="app-card-head">
              <AppIcon app={app} />
              <span className="app-card-name">{app.displayName || app.app}</span>
              <span className="app-card-containers mono">
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
                    <span className="mono">{env.version || '—'}</span>
                    <StatusPill up={env.up} />
                  </div>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </>
  )
}

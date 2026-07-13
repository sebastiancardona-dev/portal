import { Link } from 'react-router-dom'
import { useApps } from '../api/hooks'
import { fmtMs } from '../format'
import { EnvBadge, Quiet, Skeleton } from '../ui'
import { StatusListPreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * The rack panel: one dense row per app+env, status told rack-LED style
 * (dot + glow + label, never color alone). Every row links to the app.
 */

function Led({ up }: { up: boolean | null }) {
  const state = up == null ? 'off' : up ? 'ok' : 'down'
  const label = up == null ? 'N/A' : up ? 'UP' : 'DOWN'
  return (
    <span className={`led led-${state}`}>
      <span className="led-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

function StatusList(_props: WidgetProps) {
  const apps = useApps()

  if (apps.isPending) {
    return (
      <div className="status-list">
        <Skeleton height={24} />
        <Skeleton height={24} />
        <Skeleton height={24} />
      </div>
    )
  }
  if (apps.isError) return <Quiet>could not load apps</Quiet>

  const rows = apps.data.flatMap((app) => app.environments.map((env) => ({ app, env })))
  if (rows.length === 0) return <Quiet>no apps discovered yet</Quiet>

  return (
    <div className="status-list">
      {rows.map(({ app, env }) => (
        <Link key={`${app.app}:${env.env}`} to={`/apps/${encodeURIComponent(app.app)}`} className="status-row">
          <Led up={env.up} />
          <span className="status-name">{app.displayName || app.app}</span>
          <EnvBadge env={env.env} />
          <span className="status-version mono">{env.version || '—'}</span>
          <span className="status-latency mono">{env.up ? fmtMs(env.latencyMs) : ''}</span>
        </Link>
      ))}
    </div>
  )
}

export const statusListDef: WidgetDef = {
  type: 'status-list',
  label: 'App status',
  description: 'Every discovered app and environment — rack-LED up/down, version, and health-check latency.',
  category: 'health',
  Preview: StatusListPreview,
  configSchema: [],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  component: StatusList,
}

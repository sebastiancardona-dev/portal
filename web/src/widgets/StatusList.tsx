import { Link } from 'react-router-dom'
import { useApps } from '../api/hooks'
import { fmtMs } from '../format'
import { EnvBadge, Quiet, Skeleton, StatusPill } from '../ui'
import { StatusListPreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * The status panel: one dense row per app+env, status told dot + label
 * (never color alone). Every row links to the app.
 */

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
          <StatusPill up={env.up} />
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
  description: 'Every discovered app and environment — up/down status, version, and health-check latency.',
  category: 'health',
  Preview: StatusListPreview,
  configSchema: [
    { key: 'label', label: 'Title', type: 'text', hint: 'shown in the widget header' },
  ],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  component: StatusList,
}

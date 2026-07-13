import { useApps } from '../api/hooks'
import { fmtMs } from '../format'
import { EnvBadge, Quiet, Skeleton, StatusPill } from '../ui'
import type { WidgetDef, WidgetProps } from './registry'

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

  const rows = apps.data.flatMap((app) =>
    app.environments.map((env) => ({ app, env })),
  )
  if (rows.length === 0) return <Quiet>no apps discovered yet</Quiet>

  return (
    <div className="status-list">
      {rows.map(({ app, env }) => (
        <div key={`${app.app}:${env.env}`} className="status-row">
          <span className="status-name">{app.displayName || app.app}</span>
          <EnvBadge env={env.env} />
          <span className="status-version mono">{env.version || '—'}</span>
          <span className="status-latency mono">{env.up ? fmtMs(env.latencyMs) : ''}</span>
          <StatusPill up={env.up} />
        </div>
      ))}
    </div>
  )
}

export const statusListDef: WidgetDef = {
  type: 'status-list',
  label: 'App status',
  description: 'Every discovered app and environment — up/down, version, and health-check latency.',
  configSchema: [],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  component: StatusList,
}

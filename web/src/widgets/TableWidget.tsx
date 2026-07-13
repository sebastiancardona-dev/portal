import { useApps, useHost } from '../api/hooks'
import { fmtBytes, fmtPct } from '../format'
import { EnvBadge, Quiet, RelTime, Skeleton, SortTable } from '../ui'
import { TablePreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

function ContainersTable() {
  const host = useHost()
  if (host.isPending) return <Skeleton height={80} />
  if (host.isError) return <Quiet>could not load host data</Quiet>
  if (host.data.containers.length === 0) return <Quiet>no containers reported yet</Quiet>
  return (
    <SortTable
      rows={host.data.containers}
      rowKey={(c) => c.name}
      defaultSort={{ key: 'mem', dir: 'desc' }}
      columns={[
        { key: 'name', label: 'Container', get: (c) => c.name, mono: true },
        {
          key: 'cpu',
          label: 'CPU',
          get: (c) => c.cpuPct,
          render: (c) => fmtPct(c.cpuPct),
          align: 'right',
          mono: true,
        },
        {
          key: 'mem',
          label: 'Memory',
          get: (c) => c.memBytes,
          render: (c) => fmtBytes(c.memBytes),
          align: 'right',
          mono: true,
        },
      ]}
    />
  )
}

function DeploysTable() {
  const apps = useApps()
  if (apps.isPending) return <Skeleton height={80} />
  if (apps.isError) return <Quiet>could not load apps</Quiet>
  const rows = apps.data.flatMap((app) =>
    app.environments.map((env) => ({
      key: `${app.app}:${env.env}`,
      name: app.displayName || app.app,
      env: env.env,
      version: env.version,
      status: env.deployStatus,
      lastDeploy: env.lastDeploy,
    })),
  )
  if (rows.length === 0) return <Quiet>no deploys recorded yet</Quiet>
  return (
    <SortTable
      rows={rows}
      rowKey={(r) => r.key}
      defaultSort={{ key: 'when', dir: 'desc' }}
      columns={[
        { key: 'app', label: 'App', get: (r) => r.name },
        { key: 'env', label: 'Env', get: (r) => r.env, render: (r) => <EnvBadge env={r.env} /> },
        { key: 'version', label: 'Version', get: (r) => r.version ?? '', mono: true },
        {
          key: 'status',
          label: 'Status',
          get: (r) => r.status ?? '',
          render: (r) => <span className={`deploy-status ds-${(r.status || '').toLowerCase()}`}>{r.status || '—'}</span>,
        },
        {
          key: 'when',
          label: 'Deployed',
          get: (r) => new Date(r.lastDeploy ?? 0).getTime() || 0,
          render: (r) => <RelTime ts={r.lastDeploy} />,
          align: 'right',
        },
      ]}
    />
  )
}

function TableWidget({ config }: WidgetProps) {
  const dataset = config.dataset || 'containers'
  const body =
    dataset === 'deploys' ? (
      <DeploysTable />
    ) : dataset === 'containers' ? (
      <ContainersTable />
    ) : (
      <Quiet>unknown dataset “{dataset}”</Quiet>
    )
  return <div className="table-widget">{body}</div>
}

export const tableDef: WidgetDef = {
  type: 'table',
  label: 'Table',
  description: 'A sortable table over a picked dataset: per-container resources, or last deploys per app.',
  category: 'composition',
  Preview: TablePreview,
  configSchema: [
    {
      key: 'dataset',
      label: 'Dataset',
      type: 'select',
      required: true,
      options: [
        { value: 'containers', label: 'Containers (CPU / memory)' },
        { value: 'deploys', label: 'Deploys (per app + env)' },
      ],
    },
  ],
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  component: TableWidget,
}

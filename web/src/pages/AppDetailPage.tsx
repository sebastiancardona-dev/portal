import { useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useApp, useMultiSeries } from '../api/hooks'
import type { AppDetail, UptimeCell } from '../api/types'
import { fmtAbsolute, fmtBytes, fmtMs, fmtPct, shortSha } from '../format'
import { EnvBadge, Quiet, RelTime, Skeleton, SortTable, StatusPill, useMeasure } from '../ui'
import { SeriesChart, type ChartSeries } from '../widgets/SeriesChart'
import { AppIcon } from './AppsPage'

function uptimeClass(upPct: number): string {
  if (upPct >= 99.5) return 'u-ok'
  if (upPct > 0) return 'u-part'
  return 'u-down'
}

function UptimeStrip({ cells }: { cells: UptimeCell[] }) {
  if (cells.length === 0) return <Quiet>no uptime history yet</Quiet>
  return (
    <>
      <div className="uptime-strip">
        {cells.map((cell) => (
          <span
            key={cell.ts}
            className={`uptime-cell ${uptimeClass(cell.upPct)}`}
            title={`${fmtAbsolute(cell.ts)} — ${fmtPct(cell.upPct)} up`}
          />
        ))}
      </div>
      <div className="uptime-legend">
        <span>
          <span className="uptime-cell u-ok" /> up
        </span>
        <span>
          <span className="uptime-cell u-part" /> partial
        </span>
        <span>
          <span className="uptime-cell u-down" /> down
        </span>
        <span className="muted">hourly · last 7 days</span>
      </div>
    </>
  )
}

function LatencyChart({ app }: { app: AppDetail }) {
  const envs = app.environments.map((e) => e.env)
  const queries = useMultiSeries(
    envs.map((env) => `latency:${app.app}:${env}`),
    '6h',
    '5m',
  )
  const [measureRef, size] = useMeasure()

  const series: ChartSeries[] = []
  envs.forEach((env, i) => {
    const q = queries[i]
    if (q?.data && q.data.length > 0) series.push({ label: env, points: q.data })
  })

  const loading = queries.some((q) => q.isPending)
  const allGone = queries.length > 0 && queries.every((q) => q.isError && q.error instanceof ApiError && q.error.status === 404)

  return (
    <div ref={measureRef} className="panel-chart">
      {loading ? (
        <Skeleton height={200} />
      ) : allGone ? (
        <Quiet>source unavailable</Quiet>
      ) : series.length === 0 ? (
        <Quiet>no latency data yet</Quiet>
      ) : (
        size.width > 0 && <SeriesChart series={series} width={size.width} height={220} unit="ms" />
      )}
    </div>
  )
}

export function AppDetailPage() {
  const { app: appName } = useParams()
  const q = useApp(appName)

  if (q.isPending) {
    return (
      <div className="page-skeleton">
        <Skeleton height={60} />
        <Skeleton height={140} />
        <Skeleton height={220} />
      </div>
    )
  }
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) {
      return <Quiet>app “{appName}” is not known (anymore) — it may have been undeployed</Quiet>
    }
    return <Quiet>could not load app details</Quiet>
  }
  const app = q.data

  return (
    <>
      <header className="page-head">
        <AppIcon app={app} />
        <h1 className="page-title">{app.displayName || app.app}</h1>
        {app.url && (
          <a className="btn btn-ghost" href={app.url} target="_blank" rel="noreferrer">
            open ↗
          </a>
        )}
      </header>

      <section className="env-blocks">
        {app.environments.length === 0 && <Quiet>no environments reported</Quiet>}
        {app.environments.map((env) => (
          <div key={env.env} className="panel env-block">
            <div className="env-block-head">
              <EnvBadge env={env.env} />
              <StatusPill up={env.up} />
              {env.url && (
                <a className="env-url" href={env.url} target="_blank" rel="noreferrer">
                  {env.url.replace(/^https?:\/\//, '')} ↗
                </a>
              )}
            </div>
            <dl className="kv">
              <dt>version</dt>
              <dd className="mono">{env.version || '—'}</dd>
              <dt>commit</dt>
              <dd className="mono">{shortSha(env.gitSha)}</dd>
              <dt>deploy</dt>
              <dd>
                <span className={`deploy-status ds-${(env.deployStatus || '').toLowerCase()}`}>
                  {env.deployStatus || '—'}
                </span>{' '}
                <RelTime ts={env.lastDeploy} />
              </dd>
              <dt>latency</dt>
              <dd className="mono">{env.up ? fmtMs(env.latencyMs) : '—'}</dd>
            </dl>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2 className="panel-title">Uptime</h2>
        <UptimeStrip cells={app.uptime7d} />
      </section>

      <section className="panel">
        <h2 className="panel-title">Health-check latency · 6h</h2>
        <LatencyChart app={app} />
      </section>

      <div className="panel-row">
        <section className="panel">
          <h2 className="panel-title">Containers</h2>
          {app.containers.length === 0 ? (
            <Quiet>no containers mapped to this app</Quiet>
          ) : (
            <SortTable
              rows={app.containers}
              rowKey={(c) => c.name}
              columns={[
                { key: 'name', label: 'Container', get: (c) => c.name, mono: true },
                { key: 'state', label: 'State', get: (c) => c.state },
                { key: 'cpu', label: 'CPU', get: (c) => c.cpuPct, render: (c) => fmtPct(c.cpuPct), align: 'right', mono: true },
                { key: 'mem', label: 'Memory', get: (c) => c.memBytes, render: (c) => fmtBytes(c.memBytes), align: 'right', mono: true },
              ]}
            />
          )}
        </section>

        <section className="panel">
          <h2 className="panel-title">Deploy history</h2>
          {app.deployHistory.length === 0 ? (
            <Quiet>no deploys recorded yet</Quiet>
          ) : (
            <ul className="deploy-history">
              {app.deployHistory.map((d, i) => (
                <li key={`${d.ts}-${i}`}>
                  <RelTime ts={d.ts} />
                  <EnvBadge env={d.env} />
                  <span>{d.event}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

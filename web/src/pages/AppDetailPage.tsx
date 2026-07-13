import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { ApiError } from '../api/client'
import { useApp, useMultiSeries } from '../api/hooks'
import type { AppDetail } from '../api/types'
import { HeatStrip, TimeSeriesChart } from '../charts'
import { fmtBytes, fmtMs, fmtPct, shortSha } from '../format'
import {
  appStatusState,
  EnvBadge,
  Quiet,
  RelTime,
  Skeleton,
  SortTable,
  StatusDot,
  useMeasure,
  type StatusState,
} from '../ui'
import { AppIcon } from './AppsPage'

function containerStatus(state: string): StatusState {
  const s = state.toLowerCase()
  if (s === 'running') return 'ok'
  if (s === 'restarting' || s === 'paused') return 'warn'
  if (s === 'exited' || s === 'dead') return 'down'
  return 'off'
}

function eventStatus(event: string): StatusState {
  const e = event.toLowerCase()
  if (e.includes('rollback') || e.includes('rolled back')) return 'serious'
  if (e.includes('fail')) return 'down'
  if (e.includes('healthy')) return 'ok'
  return 'off'
}

/** Short sha that copies the full sha on click — quiet "copied" confirmation. */
function CopySha({ sha }: { sha: string | null }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(id)
  }, [copied])
  if (!sha) return <span className="muted">—</span>
  return (
    <button
      type="button"
      className={`copy-sha${copied ? ' copied' : ''}`}
      title={`${sha} — click to copy`}
      onClick={() => {
        navigator.clipboard?.writeText(sha).then(
          () => setCopied(true),
          () => {},
        )
      }}
    >
      {copied ? (
        <Check size={12} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Copy size={12} strokeWidth={1.75} aria-hidden="true" />
      )}
      {copied ? 'copied' : shortSha(sha)}
    </button>
  )
}

function UptimeSection({ app }: { app: AppDetail }) {
  const [ref, size] = useMeasure()
  return (
    <section className="panel">
      <h2 className="panel-title">Uptime · 7d hourly</h2>
      <div ref={ref} className="panel-chart">
        {app.uptime7d.length === 0 ? (
          <Quiet>no uptime history yet</Quiet>
        ) : (
          size.width > 0 && (
            <HeatStrip
              cells={app.uptime7d.map((c) => ({ ts: c.ts, value: c.upPct }))}
              width={size.width}
            />
          )
        )}
      </div>
    </section>
  )
}

function LatencySection({ app }: { app: AppDetail }) {
  const envs = app.environments.map((e) => e.env)
  const queries = useMultiSeries(
    envs.map((env) => `latency:${app.app}:${env}`),
    '6h',
    '5m',
  )
  const [ref, size] = useMeasure()

  const series = envs
    .map((env, i) => ({ label: env, points: queries[i]?.data ?? [], slot: i + 1 }))
    .filter((s) => s.points.length > 0)

  const loading = queries.some((q) => q.isPending)
  const allGone =
    queries.length > 0 &&
    queries.every((q) => q.isError && q.error instanceof ApiError && q.error.status === 404)

  return (
    <section className="panel">
      <h2 className="panel-title">Latency · 6h</h2>
      <div ref={ref} className="panel-chart">
        {loading ? (
          <Skeleton height={200} />
        ) : allGone ? (
          <Quiet>source unavailable</Quiet>
        ) : series.length === 0 ? (
          <Quiet>no latency data yet</Quiet>
        ) : (
          size.width > 0 && (
            <TimeSeriesChart series={series} width={size.width} height={220} unit="ms" showLegend />
          )
        )}
      </div>
    </section>
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
        <div className="page-id">
          <span className="eyebrow">Application</span>
          <div className="page-title-row">
            <StatusDot state={appStatusState(app.environments)} />
            <AppIcon app={app} />
            <h1 className="page-title">{app.displayName || app.app}</h1>
          </div>
        </div>
        {app.url && (
          <a className="btn btn-ghost btn-sm" href={app.url} target="_blank" rel="noreferrer">
            open
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" />
          </a>
        )}
      </header>

      <section className="env-blocks">
        {app.environments.length === 0 && <Quiet>no environments reported</Quiet>}
        {app.environments.map((env) => (
          <div key={env.env} className="panel env-block">
            <div className="env-block-head">
              <EnvBadge env={env.env} />
              {env.up == null ? (
                <StatusDot state="off" label="N/A" />
              ) : env.up ? (
                <StatusDot state="ok" label="UP" />
              ) : (
                <StatusDot state="down" label="DOWN" />
              )}
              {env.url && (
                <a className="env-url" href={env.url} target="_blank" rel="noreferrer">
                  {env.url.replace(/^https?:\/\//, '')}
                  <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
                </a>
              )}
            </div>
            <dl className="kv">
              <dt>version</dt>
              <dd className="mono">{env.version || '—'}</dd>
              <dt>commit</dt>
              <dd>
                <CopySha sha={env.gitSha} />
              </dd>
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

      <UptimeSection app={app} />
      <LatencySection app={app} />

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
                {
                  key: 'state',
                  label: 'State',
                  get: (c) => c.state,
                  render: (c) => <StatusDot state={containerStatus(c.state)} label={c.state} />,
                },
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
            <ul className="feed">
              {[...app.deployHistory].reverse().map((d, i) => (
                <li key={`${d.ts}-${i}`}>
                  <StatusDot state={eventStatus(d.event)} />
                  <span className="feed-time">
                    <RelTime ts={d.ts} />
                  </span>
                  <EnvBadge env={d.env} />
                  <span className="feed-event">{d.event}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

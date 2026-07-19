import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SearchCode } from 'lucide-react'
import { api, ApiError } from '../api/client'
import { useLogsFields, useLogsQuery, useMe } from '../api/hooks'
import type { LogEntry, LogSeries as LogSeriesType, TailResponse } from '../api/types'
import { SERIES_RANGES } from '../api/types'
import { TimeSeriesChart } from '../charts/TimeSeriesChart'
import { EmptyState, Quiet, Skeleton, SortTable, StatusDot, useMeasure, type StatusState } from '../ui'

/** Filters are a DQL builder — the query bar is the single source of truth. */
interface Filters {
  app: string
  env: string
  level: string // '' | '>=WARN' | exact
  text: string
}

const EMPTY_FILTERS: Filters = { app: '', env: '', level: '', text: '' }

function buildDql(filters: Filters): string {
  const conditions: string[] = []
  if (filters.app) conditions.push(`app == "${filters.app}"`)
  if (filters.env) conditions.push(`env == "${filters.env}"`)
  if (filters.level === '>=WARN') conditions.push(`level >= "WARN"`)
  else if (filters.level) conditions.push(`level == "${filters.level}"`)
  if (filters.text.trim()) conditions.push(`message contains "${filters.text.trim().replace(/"/g, '\\"')}"`)
  return conditions.length === 0 ? 'fetch logs' : `fetch logs | filter ${conditions.join(' and ')}`
}

function levelState(level: string | undefined): StatusState {
  if (level === 'ERROR') return 'down'
  if (level === 'WARN') return 'warn'
  if (level === 'INFO') return 'ok'
  return 'off'
}

function clock(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false })
}

/** Structured lines show their message; raw lines (nginx/traefik) show as-is. */
function messageOf(entry: LogEntry): string {
  if (entry.line.startsWith('{')) {
    try {
      const parsed = JSON.parse(entry.line)
      if (typeof parsed.message === 'string') return parsed.message
    } catch {
      /* raw line */
    }
  }
  return entry.line
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false)
  const level = entry.labels.level
  return (
    <>
      <tr className="log-row" onClick={() => setOpen((v) => !v)}>
        <td className="mono log-time" title={new Date(entry.ts).toLocaleString()}>
          {clock(entry.ts)}
        </td>
        <td className="log-level">
          <StatusDot state={levelState(level)} label={level ?? 'raw'} />
        </td>
        <td className="mono log-app">
          {entry.labels.app}
          <span className="log-env">·{entry.labels.env}</span>
        </td>
        <td className="log-message">{messageOf(entry)}</td>
      </tr>
      {open && (
        <tr className="log-detail">
          <td colSpan={4}>
            <pre>{prettyLine(entry)}</pre>
          </td>
        </tr>
      )}
    </>
  )
}

function prettyLine(entry: LogEntry): string {
  const labels = Object.entries(entry.labels).map(([k, v]) => `${k}=${v}`).join('  ')
  try {
    return labels + '\n' + JSON.stringify(JSON.parse(entry.line), null, 2)
  } catch {
    return labels + '\n' + entry.line
  }
}

function seriesLabel(labels: Record<string, string>): string {
  const entries = Object.entries(labels)
  return entries.length === 0 ? 'count' : entries.map(([, v]) => v).join(' · ')
}

/** Own component so useMeasure mounts WITH the div — a page-level hook would
 *  observe a ref that doesn't exist while the query is still pending. */
function SeriesChart({ series }: { series: LogSeriesType[] }) {
  const [ref, size] = useMeasure()
  return (
    <div className="panel-chart" ref={ref} style={{ height: 300 }}>
      {size.width > 0 && (
        <TimeSeriesChart
          series={series.map((s) => ({ label: seriesLabel(s.labels), points: s.points }))}
          width={size.width}
          height={300}
          kind={series.length === 1 ? 'bar' : 'line'}
          showLegend={series.length > 1}
        />
      )}
    </div>
  )
}

export function LogsPage() {
  const me = useMe()
  const fields = useLogsFields()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [range, setRange] = useState('1h')
  const [dql, setDql] = useState('fetch logs')
  const [edited, setEdited] = useState(false)
  const [submitted, setSubmitted] = useState('fetch logs')
  const [tailing, setTailing] = useState(false)
  const [tailEntries, setTailEntries] = useState<LogEntry[]>([])
  const tailCursor = useRef<string | null>(null)
  const tailBox = useRef<HTMLDivElement>(null)

  const result = useLogsQuery(submitted, range, !tailing)

  function applyFilters(next: Filters) {
    setFilters(next)
    const built = buildDql(next)
    setDql(built)
    setEdited(false)
    setSubmitted(built)
  }

  // live tail: short-poll /api/logs/tail with a nanosecond cursor
  useEffect(() => {
    if (!tailing) return
    let cancelled = false
    async function poll() {
      try {
        const cursor = tailCursor.current
        const response = await api<TailResponse>(
          `/api/logs/tail?q=${encodeURIComponent(submitted)}` +
            (cursor ? `&sinceNs=${cursor}` : ''),
        )
        if (cancelled) return
        tailCursor.current = response.nowNs
        if (response.entries.length > 0) {
          setTailEntries((prev) => [...prev, ...response.entries].slice(-500))
        }
      } catch {
        /* keep polling — a blip must not kill the tail */
      }
    }
    poll()
    const id = setInterval(poll, 2500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [tailing, submitted])

  // pin to the bottom while tailing (unless the operator scrolled up)
  useEffect(() => {
    const box = tailBox.current
    if (tailing && box && box.scrollHeight - box.scrollTop - box.clientHeight < 120) {
      box.scrollTop = box.scrollHeight
    }
  }, [tailEntries, tailing])

  if (me.data && me.data.role !== 'admin') {
    return <Quiet>admin access is required for the logs module</Quiet>
  }
  if (fields.isPending) {
    return (
      <div className="page-skeleton">
        <Skeleton height={60} />
        <Skeleton height={300} />
      </div>
    )
  }
  if (fields.isError) {
    return <Quiet>could not load the logs module — {fields.error.message}</Quiet>
  }
  if (!fields.data.available) {
    return (
      <>
        <LogsHead />
        <EmptyState icon={<SearchCode size={20} strokeWidth={1.5} />}>
          the logs pipeline is not connected in this environment — Loki runs on the VPS
          (infra SETUP §16); locally: docker compose up + node scripts/seed-local-loki.mjs
        </EmptyState>
      </>
    )
  }

  const entries = tailing ? tailEntries : (result.data?.entries ?? [])
  const dqlError = result.error instanceof ApiError ? result.error : null

  return (
    <>
      <LogsHead />

      <section className="panel">
        <div className="logs-toolbar">
          <label>
            <span>App</span>
            <select value={filters.app} onChange={(e) => applyFilters({ ...filters, app: e.target.value })}>
              <option value="">all</option>
              {fields.data.apps.map((app) => (
                <option key={app} value={app}>{app}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Env</span>
            <select value={filters.env} onChange={(e) => applyFilters({ ...filters, env: e.target.value })}>
              <option value="">all</option>
              {fields.data.envs.map((env) => (
                <option key={env} value={env}>{env}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Level</span>
            <select value={filters.level} onChange={(e) => applyFilters({ ...filters, level: e.target.value })}>
              <option value="">all</option>
              <option value=">=WARN">≥ WARN</option>
              {fields.data.levels.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label className="logs-text">
            <span>Contains</span>
            <input
              type="text"
              value={filters.text}
              placeholder="search message text"
              onChange={(e) => setFilters({ ...filters, text: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters(filters)}
              onBlur={() => applyFilters(filters)}
            />
          </label>
          <label>
            <span>Range</span>
            <select value={range} onChange={(e) => setRange(e.target.value)} disabled={tailing}>
              {SERIES_RANGES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`btn btn-sm${tailing ? ' btn-primary' : ''}`}
            onClick={() => {
              setTailEntries([])
              tailCursor.current = null
              setTailing((v) => !v)
            }}
            title={tailing ? 'Stop following new lines' : 'Follow new lines live'}
          >
            {tailing ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
            {tailing ? 'Stop tail' : 'Live tail'}
          </button>
        </div>

        <form
          className="logs-querybar"
          onSubmit={(e) => {
            e.preventDefault()
            setSubmitted(dql)
          }}
        >
          <input
            type="text"
            className="mono logs-query-input"
            value={dql}
            spellCheck={false}
            aria-label="DQL query"
            onChange={(e) => {
              setDql(e.target.value)
              setEdited(true)
            }}
          />
          <button type="submit" className="btn btn-sm">Run</button>
          {edited && <span className="logs-edited">edited — filters won't apply until Run</span>}
        </form>
        {dqlError && (
          <p className="form-error logs-error">
            {dqlError.message}
          </p>
        )}
        {result.data && !tailing && (
          <p className="logs-compiled mono" title="the LogQL this query compiled to">
            → {result.data.logql}
          </p>
        )}
      </section>

      <section className="panel">
        {tailing ? (
          <>
            <h2 className="panel-title">Live tail</h2>
            <div className="logs-scroll" ref={tailBox}>
              <table className="data-table logs-table">
                <tbody>
                  {tailEntries.map((entry, i) => (
                    <LogRow key={`${entry.ts}-${i}`} entry={entry} />
                  ))}
                </tbody>
              </table>
              {tailEntries.length === 0 && <Quiet>waiting for new lines…</Quiet>}
            </div>
          </>
        ) : result.isPending ? (
          <Skeleton height={280} />
        ) : result.isError ? (
          <Quiet>{dqlError ? 'fix the query above' : 'query failed'}</Quiet>
        ) : result.data.kind === 'series' ? (
          result.data.series.length === 0 ? (
            <Quiet>no matching log volume in this range</Quiet>
          ) : (
            <SeriesChart series={result.data.series} />
          )
        ) : result.data.kind === 'totals' ? (
          result.data.totals.length === 0 ? (
            <Quiet>nothing matched</Quiet>
          ) : (
            <SortTable
              rows={result.data.totals}
              rowKey={(t) => JSON.stringify(t.labels)}
              defaultSort={{ key: 'count', dir: 'desc' }}
              columns={[
                {
                  key: 'group',
                  label: 'Group',
                  mono: true,
                  get: (t) => seriesLabel(t.labels),
                },
                {
                  key: 'count',
                  label: 'Count',
                  align: 'right',
                  mono: true,
                  get: (t) => t.value,
                  render: (t) => t.value.toLocaleString(),
                },
              ]}
            />
          )
        ) : entries.length === 0 ? (
          <Quiet>no log lines matched — widen the range or drop a filter</Quiet>
        ) : (
          <div className="logs-scroll">
            <table className="data-table logs-table">
              <tbody>
                {entries.map((entry, i) => (
                  <LogRow key={`${entry.ts}-${i}`} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function LogsHead() {
  return (
    <header className="page-head">
      <div className="page-id">
        <span className="eyebrow">Modules</span>
        <h1 className="page-title">Logs</h1>
      </div>
      <div className="page-meta mono">Loki · 14d retention · queried live</div>
    </header>
  )
}

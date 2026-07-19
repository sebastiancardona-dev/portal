import { ApiError } from '../api/client'
import { useLogsQuery, useMe } from '../api/hooks'
import { TimeSeriesChart } from '../charts/TimeSeriesChart'
import { Quiet, Skeleton } from '../ui'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * A saved DQL query on the dashboard grid (project 07). The query's shape
 * picks the rendering: summarize-by-bin → chart, summarize totals → ranked
 * list, raw logs → the latest lines. Admin-only data — viewers see a quiet
 * note, not an error wall.
 */

function seriesLabel(labels: Record<string, string>): string {
  const entries = Object.entries(labels)
  return entries.length === 0 ? 'count' : entries.map(([, v]) => v).join(' · ')
}

function LogsQueryWidget({ config, width, height }: WidgetProps) {
  const me = useMe()
  const query = config.query || 'fetch logs | filter level == "ERROR" | summarize count() by bin(1h)'
  const range = config.range || '24h'
  const admin = me.data?.role === 'admin'
  const result = useLogsQuery(query, range, admin)

  if (me.data && !admin) return <Quiet>admin only</Quiet>
  if (result.isPending) return <Skeleton height={Math.max(60, height - 20)} />
  if (result.isError) {
    const status = result.error instanceof ApiError ? result.error.status : 0
    if (status === 503) return <Quiet>logs pipeline not connected</Quiet>
    if (status === 400) return <Quiet>invalid query — edit this widget</Quiet>
    return <Quiet>logs unavailable</Quiet>
  }

  const data = result.data
  if (data.kind === 'series') {
    if (data.series.length === 0) return <Quiet>no matching log volume</Quiet>
    return (
      <TimeSeriesChart
        series={data.series.map((s) => ({ label: seriesLabel(s.labels), points: s.points }))}
        width={width}
        height={height}
        kind="bar"
        showLegend={data.series.length > 1}
      />
    )
  }
  if (data.kind === 'totals') {
    if (data.totals.length === 0) return <Quiet>nothing matched</Quiet>
    return (
      <div className="logs-widget-totals">
        {data.totals.map((t) => (
          <div key={JSON.stringify(t.labels)} className="logs-widget-row">
            <span className="mono logs-widget-label">{seriesLabel(t.labels)}</span>
            <span className="mono logs-widget-count">{t.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }
  if (data.entries.length === 0) return <Quiet>no log lines matched</Quiet>
  return (
    <div className="logs-widget-lines">
      {data.entries.slice(0, 30).map((entry, i) => (
        <div key={`${entry.ts}-${i}`} className="logs-widget-line" title={entry.line}>
          <span className={`logs-widget-level lw-${(entry.labels.level ?? 'raw').toLowerCase()}`}>
            {entry.labels.level ?? 'raw'}
          </span>
          <span className="mono">{entry.labels.app}</span>
          <span className="logs-widget-msg">{entry.line}</span>
        </div>
      ))}
    </div>
  )
}

function LogsQueryPreview() {
  const bars = [12, 9, 16, 7, 21, 30, 14, 10, 26, 18]
  const max = Math.max(...bars)
  return (
    <svg viewBox="0 0 120 48" role="img" aria-label="logs query preview">
      {bars.map((v, i) => (
        <rect
          key={i}
          x={4 + i * 11.5}
          y={44 - (v / max) * 36}
          width={8}
          height={(v / max) * 36}
          rx={1.5}
          fill={i === 5 || i === 8 ? 'var(--down)' : 'var(--series-1)'}
          opacity={0.9}
        />
      ))}
    </svg>
  )
}

export const logsQueryDef: WidgetDef = {
  type: 'logs-query',
  label: 'Logs query',
  description: 'A saved DQL query — error rates, noisiest apps, or the latest matching lines.',
  category: 'events',
  Preview: LogsQueryPreview,
  configSchema: [
    { key: 'label', label: 'Title', type: 'text', hint: 'shown in the widget header' },
    {
      key: 'query',
      label: 'DQL query',
      type: 'text',
      required: true,
      hint: 'e.g. fetch logs | filter level == "ERROR" | summarize count() by bin(1h)',
    },
    {
      key: 'range',
      label: 'Range',
      type: 'select',
      options: [
        { value: '1h', label: 'last hour' },
        { value: '6h', label: 'last 6 hours' },
        { value: '24h', label: 'last 24 hours' },
        { value: '7d', label: 'last 7 days' },
      ],
    },
  ],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  component: LogsQueryWidget,
}

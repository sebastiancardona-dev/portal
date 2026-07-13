import { useMemo } from 'react'
import { useSeries, useSources } from '../api/hooks'
import { ApiError } from '../api/client'
import { Quiet, Skeleton } from '../ui'
import { TimeSeriesChart } from '../charts'
import { useDeploys } from './widgetHooks'
import { BarChartPreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * Time-bucketed bars: deploy cadence over the last 7 days, or any gauge
 * source folded into 1h buckets over the last 24h.
 */

const DAY = 86_400_000

function DeploysPerDay({ width, height }: { width: number; height: number }) {
  const deploys = useDeploys()

  const points = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = Array.from({ length: 7 }, (_, i) => today.getTime() - (6 - i) * DAY)
    const counts = new Map<number, number>(days.map((d) => [d, 0]))
    for (const ev of deploys.data ?? []) {
      const t = new Date(ev.ts)
      t.setHours(0, 0, 0, 0)
      const key = t.getTime()
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return days.map((d) => ({ ts: new Date(d).toISOString(), value: counts.get(d) ?? 0 }))
  }, [deploys.data])

  if (deploys.isPending) return <Skeleton height={Math.max(height - 16, 40)} />
  if (deploys.isError) return <Quiet>no data yet</Quiet>

  return (
    <TimeSeriesChart
      series={[{ label: 'deploys', points, slot: 1 }]}
      width={width}
      height={height}
      kind="bar"
    />
  )
}

function SourceBars({ sourceId, width, height }: { sourceId: string; width: number; height: number }) {
  const sources = useSources()
  const meta = sources.data?.find((s) => s.id === sourceId)
  const query = useSeries(sourceId, '24h', '1h')

  if ((sources.isSuccess && !meta) || (query.isError && query.error instanceof ApiError && query.error.status === 404)) {
    return <Quiet>source unavailable</Quiet>
  }
  if (query.isPending) return <Skeleton height={Math.max(height - 16, 40)} />
  if (query.isError) return <Quiet>no data yet</Quiet>

  return (
    <TimeSeriesChart
      series={[{ label: meta?.label ?? sourceId, points: query.data, slot: 1 }]}
      width={width}
      height={height}
      unit={meta?.unit}
      kind="bar"
    />
  )
}

function BarChartWidget({ config, width, height }: WidgetProps) {
  const dataset = config.dataset || 'deploys-per-day'
  const titleH = 22
  const chartH = Math.max(height - titleH, 40)

  if (dataset === 'deploys-per-day') {
    return (
      <div className="chart-widget">
        <span className="stat-label">deploys · 7d</span>
        <DeploysPerDay width={width} height={chartH} />
      </div>
    )
  }
  if (dataset === 'source-24h') {
    if (!config.source) return <Quiet>no source configured</Quiet>
    return (
      <div className="chart-widget">
        <span className="stat-label">hourly · 24h</span>
        <SourceBars sourceId={config.source} width={width} height={chartH} />
      </div>
    )
  }
  return <Quiet>unknown dataset “{dataset}”</Quiet>
}

export const barChartDef: WidgetDef = {
  type: 'bar-chart',
  label: 'Bar chart',
  description: 'Bucketed bars: deploys per day across the ecosystem, or a gauge source hour-by-hour over 24h.',
  category: 'metrics',
  Preview: BarChartPreview,
  configSchema: [
    {
      key: 'dataset',
      label: 'Dataset',
      type: 'select',
      required: true,
      options: [
        { value: 'deploys-per-day', label: 'Deploys per day (7d)' },
        { value: 'source-24h', label: 'A gauge source, hourly (24h)' },
      ],
    },
    {
      key: 'source',
      label: 'Source',
      type: 'source',
      sourceKind: 'gauge',
      required: true,
      showIf: (values) => values.dataset === 'source-24h',
    },
  ],
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  component: BarChartWidget,
}

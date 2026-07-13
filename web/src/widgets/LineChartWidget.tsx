import { useSeries, useSources } from '../api/hooks'
import { ApiError } from '../api/client'
import type { SeriesBucket, SeriesRange } from '../api/types'
import { SERIES_BUCKETS } from '../api/types'
import { Quiet, Skeleton } from '../ui'
import { SeriesChart, type ChartSeries } from './SeriesChart'
import type { WidgetDef, WidgetProps } from './registry'

function gone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

function LineChartWidget({ config, width, height }: WidgetProps) {
  const range = (config.range as SeriesRange) || '6h'
  const bucket = (config.bucket as SeriesBucket) || '5m'
  const idA = config.sourceA || undefined
  const idB = config.sourceB || undefined
  const sources = useSources()
  const metaA = sources.data?.find((s) => s.id === idA)
  const metaB = sources.data?.find((s) => s.id === idB)
  const qa = useSeries(idA, range, bucket)
  const qb = useSeries(idB, range, bucket, !!idB)

  if (!idA) return <Quiet>no source configured</Quiet>
  if ((sources.isSuccess && !metaA) || (qa.isError && gone(qa.error))) {
    return <Quiet>source unavailable</Quiet>
  }
  if (qa.isPending || (idB && qb.isPending)) return <Skeleton height={Math.max(height - 40, 40)} />
  if (qa.isError) return <Quiet>no data yet</Quiet>

  const series: ChartSeries[] = [{ label: metaA?.label ?? idA, points: qa.data }]
  if (idB && qb.data && !(sources.isSuccess && !metaB)) {
    series.push({ label: metaB?.label ?? idB, points: qb.data })
  }

  const titleH = 22
  return (
    <div className="chart-widget">
      <span className="stat-label">
        {series.length === 1 ? (metaA?.label ?? idA) : 'comparison'} · {range}
      </span>
      <SeriesChart series={series} width={width} height={Math.max(height - titleH, 40)} unit={metaA?.unit} />
    </div>
  )
}

export const lineChartDef: WidgetDef = {
  type: 'line-chart',
  label: 'Line chart',
  description: 'Time series of one or two gauge sources — bucketed averages over a chosen range.',
  configSchema: [
    { key: 'sourceA', label: 'Source', type: 'source', sourceKind: 'gauge', required: true },
    {
      key: 'sourceB',
      label: 'Second source',
      type: 'source',
      sourceKind: 'gauge',
      hint: 'optional — same unit reads best (one axis)',
    },
    { key: 'range', label: 'Range', type: 'range', required: true },
    {
      key: 'bucket',
      label: 'Bucket',
      type: 'select',
      options: SERIES_BUCKETS.map((b) => ({ value: b, label: b })),
      required: true,
    },
  ],
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  component: LineChartWidget,
}

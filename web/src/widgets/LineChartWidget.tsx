import { useSeries, useSources } from '../api/hooks'
import { ApiError } from '../api/client'
import type { SeriesBucket, SeriesRange } from '../api/types'
import { SERIES_BUCKETS } from '../api/types'
import { Quiet, Skeleton } from '../ui'
import { TimeSeriesChart, type SeriesDef } from '../charts'
import { LineChartPreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * 1–3 gauge sources over time, as lines or area washes. Slots are fixed by
 * field position (source → slot 1, source2 → slot 2, source3 → slot 3) so a
 * series keeps its color when a sibling is added or removed above it.
 */

function gone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

function LineChartWidget({ config, width, height }: WidgetProps) {
  const range = (config.range as SeriesRange) || '6h'
  const bucket = (config.bucket as SeriesBucket) || '5m'
  const kind = config.kind === 'area' ? 'area' : 'line'
  // sourceA/sourceB are the pre-redesign key names — old layouts keep working
  const ids = [
    config.source || config.sourceA || undefined,
    config.source2 || config.sourceB || undefined,
    config.source3 || undefined,
  ]
  const sources = useSources()
  const metas = ids.map((id) => sources.data?.find((s) => s.id === id))
  const q1 = useSeries(ids[0], range, bucket)
  const q2 = useSeries(ids[1], range, bucket, !!ids[1])
  const q3 = useSeries(ids[2], range, bucket, !!ids[2])
  const queries = [q1, q2, q3]

  if (!ids[0]) return <Quiet>no source configured</Quiet>
  if ((sources.isSuccess && !metas[0]) || (q1.isError && gone(q1.error))) {
    return <Quiet>source unavailable</Quiet>
  }
  if (queries.some((q, i) => ids[i] && q.isPending)) return <Skeleton height={Math.max(height - 40, 40)} />
  if (q1.isError) return <Quiet>no data yet</Quiet>

  const series: SeriesDef[] = []
  ids.forEach((id, i) => {
    const q = queries[i]
    if (!id || !q.data) return
    if (i > 0 && sources.isSuccess && !metas[i]) return // vanished secondary source: drop, keep chart
    series.push({ label: metas[i]?.label ?? id, points: q.data, slot: i + 1 })
  })

  // a user title lives in the widget header; only untitled charts introduce
  // their subject here
  const showTitle = !config.label
  const titleH = showTitle ? 22 : 0
  return (
    <div className="chart-widget">
      {showTitle && (
        <span className="stat-label">
          {series.length === 1 ? (metas[0]?.label ?? ids[0]) : 'comparison'} · {range}
        </span>
      )}
      <TimeSeriesChart
        series={series}
        width={width}
        height={Math.max(height - titleH, 40)}
        unit={metas[0]?.unit}
        kind={kind}
      />
    </div>
  )
}

export const lineChartDef: WidgetDef = {
  type: 'line-chart',
  label: 'Line chart',
  description: 'Time series of up to three gauge sources — bucketed averages, as lines or filled areas.',
  category: 'metrics',
  Preview: LineChartPreview,
  configSchema: [
    { key: 'label', label: 'Title', type: 'text', hint: 'shown in the widget header' },
    { key: 'source', label: 'Source', type: 'source', sourceKind: 'gauge', required: true },
    {
      key: 'source2',
      label: 'Second source',
      type: 'source',
      sourceKind: 'gauge',
      hint: 'optional — same unit reads best (one axis)',
    },
    {
      key: 'source3',
      label: 'Third source',
      type: 'source',
      sourceKind: 'gauge',
      showIf: (values) => !!(values.source2 || values.sourceB),
    },
    {
      key: 'kind',
      label: 'Style',
      type: 'select',
      required: true,
      options: [
        { value: 'line', label: 'Line' },
        { value: 'area', label: 'Area' },
      ],
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

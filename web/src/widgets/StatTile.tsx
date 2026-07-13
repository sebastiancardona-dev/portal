import { useLatest, useSeries, useSources } from '../api/hooks'
import { fmtValue } from '../format'
import { Quiet, RelTime, Skeleton, StatusPill } from '../ui'
import { Sparkline } from './SeriesChart'
import type { WidgetDef, WidgetProps } from './registry'

function StatTile({ config, width }: WidgetProps) {
  const sourceId = config.source || undefined
  const sources = useSources()
  const source = sources.data?.find((s) => s.id === sourceId)
  const latest = useLatest(sourceId)
  const isStatus = source?.kind === 'status'
  const wantSpark = config.sparkline !== 'off' && source != null && !isStatus
  const series = useSeries(sourceId, '6h', '5m', wantSpark)

  if (!sourceId) return <Quiet>no source configured</Quiet>
  if (sources.isSuccess && !source) return <Quiet>source unavailable</Quiet>
  // a 404 from /latest means "no data yet" (the source itself still exists —
  // vanished sources are caught above); it falls through to the isError branch

  const label = config.label || source?.label || sourceId

  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      {latest.isPending ? (
        <Skeleton height={34} width="60%" />
      ) : latest.isError ? (
        <Quiet>no data yet</Quiet>
      ) : isStatus ? (
        <div className="stat-status">
          <StatusPill up={latest.data.value === 1} />
          <span className="stat-when">
            checked <RelTime ts={latest.data.ts} />
          </span>
        </div>
      ) : (
        <>
          <span className="stat-value" title={`as of ${latest.data.ts}`}>
            {fmtValue(latest.data.value, source?.unit)}
          </span>
          {wantSpark && series.data && series.data.length > 1 && (
            <Sparkline points={series.data} width={Math.max(width - 32, 40)} height={26} />
          )}
        </>
      )}
    </div>
  )
}

export const statTileDef: WidgetDef = {
  type: 'stat-tile',
  label: 'Stat tile',
  description: 'The latest value of one source as a big number — or an UP/DOWN pill for status sources.',
  configSchema: [
    { key: 'source', label: 'Source', type: 'source', required: true },
    { key: 'label', label: 'Label override', type: 'text', hint: 'defaults to the source label' },
    {
      key: 'sparkline',
      label: 'Sparkline',
      type: 'select',
      options: [
        { value: 'on', label: 'Show 6h trend' },
        { value: 'off', label: 'Off' },
      ],
    },
  ],
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 },
  component: StatTile,
}

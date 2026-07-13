import { useLatest, useSeries, useSources } from '../api/hooks'
import { fmtValue } from '../format'
import { Quiet, RelTime, Skeleton, StatusPill } from '../ui'
import { Sparkline } from '../charts'
import { StatTilePreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * One source, one hero figure — plus a neutral-ink delta vs the start of the
 * 6h window (good/bad is ambiguous for most host metrics, so the arrow never
 * wears a status color) and an optional sparkline.
 */

function Delta({ points }: { points: { ts: string; value: number }[] }) {
  if (points.length < 2) return null
  const first = points[0].value
  const last = points[points.length - 1].value
  if (!Number.isFinite(first) || Math.abs(first) < 1e-9) return null
  const pct = ((last - first) / Math.abs(first)) * 100
  if (!Number.isFinite(pct)) return null
  const arrow = pct > 0.05 ? '▲' : pct < -0.05 ? '▼' : '—'
  return (
    <span className="stat-delta">
      <span className="stat-delta-figure">
        {arrow} {Math.abs(pct) < 0.05 ? '0.0' : Math.abs(pct).toFixed(1)}%
      </span>{' '}
      vs 6h ago
    </span>
  )
}

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
          {series.data && series.data.length > 1 && <Delta points={series.data} />}
          {wantSpark && series.data && series.data.length > 1 && (
            <Sparkline points={series.data} width={Math.max(width - 32, 40)} height={24} />
          )}
        </>
      )}
    </div>
  )
}

export const statTileDef: WidgetDef = {
  type: 'stat-tile',
  label: 'Stat tile',
  description: 'The latest value of one source as a big number, with a 6h delta — or an UP/DOWN pill for status sources.',
  category: 'metrics',
  Preview: StatTilePreview,
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

import { useLatest, useSources } from '../api/hooks'
import { Quiet, Skeleton } from '../ui'
import { Gauge, niceScale } from '../charts'
import { GaugePreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * Radial readout of one gauge source. Max is automatic: percent sources cap
 * at 100; byte sources can pair with a total source (used / total); anything
 * else gets a nice 1/2/5 ceiling. Optional warn/critical thresholds switch
 * the fill from the sequential ramp to status bands (with the band label
 * spelled out next to the value — never color alone).
 */

function isPctUnit(unit: string | undefined): boolean {
  const u = (unit ?? '').toLowerCase()
  return u === '%' || u === 'pct' || u === 'percent'
}

function parseNum(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function GaugeWidget({ config, width, height }: WidgetProps) {
  const sourceId = config.source || undefined
  const totalId = config.totalSource || undefined
  const sources = useSources()
  const source = sources.data?.find((s) => s.id === sourceId)
  const latest = useLatest(sourceId)
  const totalLatest = useLatest(totalId)

  if (!sourceId) return <Quiet>no source configured</Quiet>
  if (sources.isSuccess && !source) return <Quiet>source unavailable</Quiet>
  if (latest.isPending) return <Skeleton height={Math.max(height - 20, 40)} />
  if (latest.isError) return <Quiet>no data yet</Quiet>

  const value = latest.data.value
  const max = isPctUnit(source?.unit)
    ? 100
    : totalId && totalLatest.data
      ? totalLatest.data.value
      : niceScale(Math.max(value, 1e-9)).max

  const warn = parseNum(config.warn)
  const critical = parseNum(config.critical)
  const thresholds = warn != null && critical != null ? { warn, critical } : undefined

  return (
    <Gauge
      value={value}
      max={max}
      // with a user title the widget header names the subject — an empty
      // label keeps the dial itself quiet instead of saying it twice
      label={config.label ? '' : source?.label || sourceId}
      unit={source?.unit}
      width={width}
      height={height}
      thresholds={thresholds}
    />
  )
}

export const gaugeDef: WidgetDef = {
  type: 'gauge',
  label: 'Gauge',
  description: 'A radial dial for one gauge source — percent-aware max, optional warn/critical bands.',
  category: 'metrics',
  Preview: GaugePreview,
  configSchema: [
    { key: 'source', label: 'Source', type: 'source', sourceKind: 'gauge', required: true },
    {
      key: 'totalSource',
      label: 'Total source',
      type: 'source',
      sourceKind: 'gauge',
      hint: 'optional — pairs a byte source with its total (used / total)',
    },
    { key: 'warn', label: 'Warn at', type: 'text', hint: 'optional threshold, in the source unit' },
    { key: 'critical', label: 'Critical at', type: 'text', hint: 'optional — requires warn too' },
    { key: 'label', label: 'Title', type: 'text', hint: 'shown in the widget header' },
  ],
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 },
  component: GaugeWidget,
}

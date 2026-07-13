import { useApp } from '../api/hooks'
import { Quiet, Skeleton } from '../ui'
import { HeatStrip } from '../charts'
import { UptimeHeatmapPreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * Seven days of hourly uptime for one app, as a single heat strip. When the
 * widget is too narrow for one cell per hour (2px cells + 2px gaps), adjacent
 * hours merge pessimistically (min) — a down hour must never average away.
 */

interface Cell {
  ts: string
  value: number | null
}

function downsample(cells: Cell[], maxCells: number): Cell[] {
  if (cells.length <= maxCells) return cells
  const per = Math.ceil(cells.length / maxCells)
  const out: Cell[] = []
  for (let i = 0; i < cells.length; i += per) {
    const chunk = cells.slice(i, i + per)
    const values = chunk.map((c) => c.value).filter((v): v is number => v != null)
    out.push({ ts: chunk[0].ts, value: values.length > 0 ? Math.min(...values) : null })
  }
  return out
}

function UptimeHeatmapWidget({ config, width, height }: WidgetProps) {
  const appName = config.app || undefined
  const app = useApp(appName)

  if (!appName) return <Quiet>no app configured</Quiet>
  if (app.isPending) return <Skeleton height={Math.max(height - 20, 40)} />
  if (app.isError) return <Quiet>app unavailable</Quiet>

  const hourly: Cell[] = (app.data.uptime7d ?? []).map((c) => ({ ts: c.ts, value: c.upPct }))
  const cells = downsample(hourly, Math.max(Math.floor(width / 6), 12))
  if (cells.length === 0) return <Quiet>no uptime data yet</Quiet>

  const titleH = 22
  const legendH = 22
  const cellH = Math.min(Math.max(height - titleH - legendH - 10, 14), 34)

  return (
    <div className="chart-widget">
      <span className="stat-label">{app.data.displayName || app.data.app} · uptime 7d</span>
      <HeatStrip cells={cells} width={width} cellH={cellH} />
    </div>
  )
}

export const uptimeHeatmapDef: WidgetDef = {
  type: 'uptime-heatmap',
  label: 'Uptime heatmap',
  description: 'One app, seven days of hourly uptime — green means quiet, anything else means look.',
  category: 'health',
  Preview: UptimeHeatmapPreview,
  configSchema: [{ key: 'app', label: 'App', type: 'app', required: true }],
  defaultSize: { w: 6, h: 2 },
  minSize: { w: 3, h: 2 },
  component: UptimeHeatmapWidget,
}

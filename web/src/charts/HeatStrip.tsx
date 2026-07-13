import { useState, type JSX } from 'react'
import { fmtPct } from '../format'

/**
 * One row of uptime cells (hourly buckets). Status washes — status colors are
 * the correct palette here because up/degraded/down IS state — with a tiny
 * 3-swatch legend so the meaning is never color alone, and a per-cell hover
 * tooltip with the hour + exact %.
 */

type CellState = 'ok' | 'warn' | 'down' | 'none'

const WASH: Record<CellState, string> = {
  ok: 'color-mix(in srgb, var(--ok) 45%, transparent)',
  warn: 'color-mix(in srgb, var(--warn) 55%, transparent)',
  down: 'color-mix(in srgb, var(--down) 65%, transparent)',
  none: 'var(--border)',
}

function stateOf(value: number | null): CellState {
  if (value == null) return 'none'
  if (value >= 99.95) return 'ok'
  if (value >= 90) return 'warn'
  return 'down'
}

function fmtHour(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

export function HeatStrip({
  cells,
  width,
  cellH = 24,
}: {
  cells: { ts: string; value: number | null }[]
  width: number
  cellH?: number
}): JSX.Element {
  const [hover, setHover] = useState<number | null>(null)

  if (width < 60) return <span aria-hidden="true" />
  if (cells.length === 0) return <div className="quiet">no data yet</div>

  const hovered = hover != null ? cells[hover] : null
  const n = cells.length
  const tooltipLeft = hover != null ? Math.min((hover / n) * width, width - 150) : 0

  return (
    <div className="heatstrip" style={{ width }}>
      <div className="heatstrip-row" style={{ height: cellH }} role="img" aria-label={`uptime, ${n} buckets`}>
        {cells.map((c, i) => (
          <span
            key={c.ts}
            className="heatstrip-cell"
            style={{ background: WASH[stateOf(c.value)] }}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          />
        ))}
        {hovered && (
          <div className="chart-tooltip heatstrip-tooltip" style={{ left: tooltipLeft, top: cellH + 4 }}>
            <div className="tooltip-time">{fmtHour(hovered.ts)}</div>
            <div className="tooltip-row">
              <span className="tooltip-value">{hovered.value != null ? fmtPct(hovered.value) : '—'}</span>
              <span className="tooltip-label">uptime</span>
            </div>
          </div>
        )}
      </div>
      <div className="heatstrip-legend">
        <span className="legend-item">
          <span className="legend-chip" style={{ background: WASH.ok }} /> 100%
        </span>
        <span className="legend-item">
          <span className="legend-chip" style={{ background: WASH.warn }} /> ≥ 90%
        </span>
        <span className="legend-item">
          <span className="legend-chip" style={{ background: WASH.down }} /> &lt; 90%
        </span>
      </div>
    </div>
  )
}

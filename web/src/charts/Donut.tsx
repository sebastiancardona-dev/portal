import { useMemo, useState, type JSX } from 'react'
import { fmtBytes, fmtNumber, fmtPct } from '../format'
import { arcPath, slotColor } from './util'

/**
 * Composition ring — thin (hole ≥ 60%), 2px surface gaps between segments,
 * categorical slots in fixed order (color follows the entity in the order
 * given). Center = mono total; side legend carries chip + label + value + %.
 * More than 6 parts folds the smallest into "Other" (neutral, never a slot).
 */

interface Part {
  label: string
  value: number
}

function fmt(value: number, unit: 'bytes' | 'pct' | 'none'): string {
  if (unit === 'bytes') return fmtBytes(value)
  if (unit === 'pct') return fmtPct(value)
  return fmtNumber(value)
}

export function Donut({
  parts,
  width,
  height,
  unit = 'none',
  totalLabel,
}: {
  parts: Part[]
  width: number
  height: number
  unit?: 'bytes' | 'pct' | 'none'
  totalLabel?: string
}): JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null)

  const folded = useMemo(() => {
    const clean = parts.filter((p) => p.value > 0)
    if (clean.length <= 6) return clean.map((p, i) => ({ ...p, color: slotColor(i + 1), other: false }))
    const byValue = [...clean].sort((a, b) => b.value - a.value)
    const keepSet = new Set(byValue.slice(0, 5).map((p) => p.label))
    const kept = clean.filter((p) => keepSet.has(p.label)).map((p, i) => ({ ...p, color: slotColor(i + 1), other: false }))
    const rest = clean.filter((p) => !keepSet.has(p.label))
    kept.push({
      label: `Other (${rest.length})`,
      value: rest.reduce((sum, p) => sum + p.value, 0),
      color: 'var(--border-strong)',
      other: true,
    })
    return kept
  }, [parts])

  if (width < 100 || height < 80) return <span aria-hidden="true" />
  if (folded.length === 0) return <div className="quiet">no data yet</div>

  const total = folded.reduce((sum, p) => sum + p.value, 0)

  const legendW = Math.min(200, Math.max(110, width - height - 12))
  // cap the ring so the legend always keeps room for its labels
  const d = Math.max(Math.min(height - 6, width - legendW - 16, 160), 64)
  const R = d / 2
  const stroke = Math.max(8, R * 0.32) // hole ≥ 60% of the outer diameter
  const rMid = R - stroke / 2
  const cx = R + 2
  const cy = height / 2
  // a 2px linear surface gap, expressed in degrees at the mid radius
  const gapDeg = folded.length > 1 ? Math.min((2 / rMid) * (180 / Math.PI) * 2, 8) : 0

  let acc = 0
  const segments = folded.map((p) => {
    const a0 = (acc / total) * 360
    acc += p.value
    const a1 = (acc / total) * 360
    const g = Math.min(gapDeg, (a1 - a0) * 0.4)
    return { ...p, a0: a0 + g / 2, a1: a1 - g / 2, pct: (p.value / total) * 100 }
  })

  const hoveredSeg = segments.find((s) => s.label === hovered)

  return (
    <div className="donut" style={{ width, height }}>
      <div className="donut-ring" style={{ width: d + 4, height }}>
        <svg width={d + 4} height={height} role="img" aria-label={totalLabel ?? 'composition'}>
          {segments.length === 1 ? (
            <circle
              cx={cx}
              cy={cy}
              r={rMid}
              fill="none"
              stroke={segments[0].color}
              strokeWidth={stroke}
            />
          ) : (
            segments.map((s) => (
              <path
                key={s.label}
                d={arcPath(cx, cy, rMid, s.a0, s.a1)}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                opacity={hovered == null || hovered === s.label ? 1 : 0.45}
                onPointerEnter={() => setHovered(s.label)}
                onPointerLeave={() => setHovered(null)}
              />
            ))
          )}
        </svg>
        <div className="donut-center" style={{ left: cx, top: cy }}>
          <span className="donut-total">{fmt(total, unit)}</span>
          {totalLabel && <span className="donut-total-label">{totalLabel}</span>}
        </div>
        {hoveredSeg && (
          <div className="chart-tooltip donut-tooltip" style={{ left: Math.min(cx + 10, width - 150), top: 4 }}>
            <div className="tooltip-row">
              <span className="legend-chip" style={{ background: hoveredSeg.color }} />
              <span className="tooltip-value">{fmt(hoveredSeg.value, unit)}</span>
              <span className="tooltip-label">{hoveredSeg.label}</span>
            </div>
            <div className="tooltip-time">{hoveredSeg.pct.toFixed(1)}% of total</div>
          </div>
        )}
      </div>
      <div className="donut-legend">
        {segments.map((s) => (
          <div
            key={s.label}
            className="donut-legend-row"
            onPointerEnter={() => setHovered(s.label)}
            onPointerLeave={() => setHovered(null)}
          >
            <span className="legend-chip" style={{ background: s.color }} />
            <span className="donut-legend-label">{s.label}</span>
            <span className="donut-legend-value">{fmt(s.value, unit)}</span>
            <span className="donut-legend-pct">{s.pct >= 10 ? Math.round(s.pct) : s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Point } from '../api/types'
import { fmtAbsolute, fmtTimeTick, fmtValue } from '../format'
import { Quiet } from '../ui'

/**
 * Hand-rolled responsive SVG time-series chart (no chart library).
 * Dataviz rules applied: 2px monotone line, ~10% area wash, hairline solid
 * gridlines, nice y ticks, crosshair + one tooltip listing every series,
 * text in text tokens (never the series color), legend only for ≥ 2 series.
 */

export interface ChartSeries {
  label: string
  points: Point[]
  /** CSS color — defaults to the categorical slot for its index */
  color?: string
}

const SLOT_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']

interface XY {
  x: number
  y: number
}

/** Fritsch–Carlson monotone cubic — smooth but never overshoots the data. */
function monotonePath(points: XY[]): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M ${points[0].x} ${points[0].y}`
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x || 1e-6)
    slope.push((points[i + 1].y - points[i].y) / (dx[i] || 1e-6))
  }
  const tangent: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  }
  tangent.push(slope[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
    } else {
      const a = tangent[i] / slope[i]
      const b = tangent[i + 1] / slope[i]
      const s = a * a + b * b
      if (s > 9) {
        const scale = 3 / Math.sqrt(s)
        tangent[i] = scale * a * slope[i]
        tangent[i + 1] = scale * b * slope[i]
      }
    }
  }
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const cp1x = points[i].x + dx[i] / 3
    const cp1y = points[i].y + (tangent[i] * dx[i]) / 3
    const cp2x = points[i + 1].x - dx[i] / 3
    const cp2y = points[i + 1].y - (tangent[i + 1] * dx[i]) / 3
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${points[i + 1].x.toFixed(2)} ${points[i + 1].y.toFixed(2)}`
  }
  return d
}

/** Round the axis max up to a clean 1/2/5 step so ticks read as clean numbers. */
function niceScale(maxValue: number, tickCount = 4): { max: number; ticks: number[] } {
  const target = maxValue <= 0 ? 1 : maxValue
  const rawStep = target / tickCount
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  const max = Math.ceil(target / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(v)
  return { max, ticks }
}

export function SeriesChart({
  series,
  width,
  height,
  unit,
}: {
  series: ChartSeries[]
  width: number
  height: number
  unit?: string
}) {
  const [hoverTs, setHoverTs] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const model = useMemo(() => {
    const populated = series.filter((s) => s.points.length > 0)
    if (populated.length === 0) return null
    const allTs = [...new Set(populated.flatMap((s) => s.points.map((p) => new Date(p.ts).getTime())))]
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b)
    if (allTs.length === 0) return null
    const tMin = allTs[0]
    const tMax = allTs[allTs.length - 1]
    const vMax = Math.max(...populated.flatMap((s) => s.points.map((p) => p.value)))
    const { max, ticks } = niceScale(vMax)
    return { allTs, tMin, tMax: tMax === tMin ? tMin + 1 : tMax, vMax: max, ticks }
  }, [series])

  const legend = series.length >= 2 && (
    <div className="chart-legend">
      {series.map((s, i) => (
        <span key={s.label} className="legend-item">
          <span className="legend-key" style={{ background: s.color ?? SLOT_COLORS[i % SLOT_COLORS.length] }} />
          {s.label}
        </span>
      ))}
    </div>
  )

  if (width < 40 || height < 40) return null
  if (!model) {
    return <Quiet>no data yet</Quiet>
  }

  const legendH = series.length >= 2 ? 22 : 0
  const pad = { top: 8, right: 10, bottom: 18, left: 46 }
  const plotW = Math.max(width - pad.left - pad.right, 10)
  const plotH = Math.max(height - legendH - pad.top - pad.bottom, 10)
  const x = (t: number) => pad.left + ((t - model.tMin) / (model.tMax - model.tMin)) * plotW
  const y = (v: number) => pad.top + plotH - (v / model.vMax) * plotH
  const baseline = pad.top + plotH

  const paths = series.map((s, i) => {
    const pts = s.points
      .map((p) => ({ t: new Date(p.ts).getTime(), v: p.value }))
      .filter((p) => !Number.isNaN(p.t))
      .sort((a, b) => a.t - b.t)
      .map((p) => ({ x: x(p.t), y: y(p.v) }))
    const line = monotonePath(pts)
    const area =
      pts.length > 1
        ? `${line} L ${pts[pts.length - 1].x.toFixed(2)} ${baseline} L ${pts[0].x.toFixed(2)} ${baseline} Z`
        : ''
    return { line, area, color: s.color ?? SLOT_COLORS[i % SLOT_COLORS.length], pts }
  })

  // ~4 x labels, evenly spaced across the domain
  const span = model.tMax - model.tMin
  const xTickCount = plotW > 420 ? 5 : plotW > 220 ? 4 : 3
  const xTicks = Array.from({ length: xTickCount }, (_, i) => model.tMin + (span * i) / (xTickCount - 1))

  // hover: values per series at the hovered timestamp
  const hover =
    hoverTs != null
      ? {
          ts: hoverTs,
          px: x(hoverTs),
          rows: series.map((s, i) => {
            const point = s.points.find((p) => new Date(p.ts).getTime() === hoverTs)
            return {
              label: s.label,
              color: s.color ?? SLOT_COLORS[i % SLOT_COLORS.length],
              value: point?.value,
            }
          }),
        }
      : null

  function nearestTs(clientX: number): number | null {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const px = clientX - rect.left
    let best: number | null = null
    let bestDist = Infinity
    for (const t of model!.allTs) {
      const d = Math.abs(x(t) - px)
      if (d < bestDist) {
        bestDist = d
        best = t
      }
    }
    return best
  }

  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    setHoverTs(nearestTs(e.clientX))
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    const ts = model!.allTs
    if (e.key === 'Escape') return setHoverTs(null)
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const idx = hoverTs == null ? ts.length - 1 : ts.indexOf(hoverTs)
    const next = e.key === 'ArrowLeft' ? Math.max(idx - 1, 0) : Math.min(idx + 1, ts.length - 1)
    setHoverTs(ts[next])
  }

  const tooltipLeft = hover ? (hover.px > width - 150 ? hover.px - 148 : hover.px + 10) : 0

  return (
    <div className="chart" style={{ width, height }}>
      {legend}
      <div className="chart-plot" style={{ height: height - legendH }}>
        <svg
          ref={svgRef}
          width={width}
          height={height - legendH}
          role="img"
          tabIndex={0}
          aria-label={`Chart: ${series.map((s) => s.label).join(', ')}`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverTs(null)}
          onKeyDown={onKeyDown}
        >
          {/* gridlines + y ticks */}
          {model.ticks.map((v) => (
            <g key={v}>
              <line
                x1={pad.left}
                x2={pad.left + plotW}
                y1={y(v)}
                y2={y(v)}
                className={v === 0 ? 'chart-baseline' : 'chart-grid'}
              />
              <text x={pad.left - 6} y={y(v) + 3} className="chart-tick" textAnchor="end">
                {fmtValue(v, unit)}
              </text>
            </g>
          ))}
          {/* x ticks */}
          {xTicks.map((t, i) => (
            <text
              key={t}
              x={x(t)}
              y={baseline + 13}
              className="chart-tick"
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            >
              {fmtTimeTick(t, span)}
            </text>
          ))}
          {/* area washes under the lines, then the lines */}
          {paths.map((p, i) => (
            <path key={`a${i}`} d={p.area} fill={p.color} opacity={0.1} stroke="none" />
          ))}
          {paths.map((p, i) => (
            <path
              key={`l${i}`}
              d={p.line}
              fill="none"
              stroke={p.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {/* crosshair + markers with a surface ring */}
          {hover && (
            <g>
              <line x1={hover.px} x2={hover.px} y1={pad.top} y2={baseline} className="chart-crosshair" />
              {hover.rows.map(
                (r, i) =>
                  r.value != null && (
                    <circle
                      key={i}
                      cx={hover.px}
                      cy={y(r.value)}
                      r={4}
                      fill={r.color}
                      stroke="var(--surface)"
                      strokeWidth={2}
                    />
                  ),
              )}
            </g>
          )}
        </svg>
        {hover && (
          <div className="chart-tooltip" style={{ left: tooltipLeft, top: pad.top }}>
            <div className="tooltip-time">{fmtAbsolute(hover.ts)}</div>
            {hover.rows.map((r) => (
              <div key={r.label} className="tooltip-row">
                <span className="legend-key" style={{ background: r.color }} />
                <span className="tooltip-value">{r.value != null ? fmtValue(r.value, unit) : '—'}</span>
                <span className="tooltip-label">{r.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Tiny inline trend — de-emphasized stroke, dot on the latest value. */
export function Sparkline({ points, width, height }: { points: Point[]; width: number; height: number }) {
  const pts = points
    .map((p) => ({ t: new Date(p.ts).getTime(), v: p.value }))
    .filter((p) => !Number.isNaN(p.t))
    .sort((a, b) => a.t - b.t)
  if (pts.length < 2 || width < 20 || height < 10) return null
  const tMin = pts[0].t
  const tMax = pts[pts.length - 1].t || tMin + 1
  const vMin = Math.min(...pts.map((p) => p.v))
  const vMax = Math.max(...pts.map((p) => p.v))
  const vSpan = vMax - vMin || 1
  const padY = 3
  const xy = pts.map((p) => ({
    x: ((p.t - tMin) / (tMax - tMin || 1)) * (width - 6) + 3,
    y: height - padY - ((p.v - vMin) / vSpan) * (height - padY * 2),
  }))
  const last = xy[xy.length - 1]
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden="true">
      <path d={monotonePath(xy)} fill="none" stroke="var(--spark)" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r={2.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  )
}

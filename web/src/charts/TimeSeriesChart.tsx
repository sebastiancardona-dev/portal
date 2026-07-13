import { useMemo, useRef, useState, type JSX, type KeyboardEvent, type PointerEvent } from 'react'
import { fmtAbsolute, fmtTimeTick, fmtValue } from '../format'
import { monotonePath, niceScale, roundedBarPath, slotColor, tsOf } from './util'

/**
 * The one time-series primitive: line, area, or time-bucketed bars.
 * Dataviz rules applied: 2px monotone lines, 10% area wash, 4px rounded bar
 * tops anchored to the baseline with 2px surface gaps, hairline grid, nice
 * 1/2/5 ticks, crosshair + one tooltip listing every series at the hovered
 * time, legend for ≥2 series plus direct labels at line ends for ≤4, and
 * text always in ink tokens (a chip carries series identity, never the text).
 */

export interface SeriesDef {
  label: string
  points: { ts: string; value: number }[]
  /** categorical slot 1-8 (fixed order; color follows the entity) — default index+1 */
  slot?: number
}

interface Prepared {
  label: string
  color: string
  pts: { t: number; v: number }[]
}

export function TimeSeriesChart({
  series,
  width,
  height,
  unit,
  kind = 'line',
  showLegend,
}: {
  series: SeriesDef[]
  width: number
  height: number
  unit?: string
  kind?: 'line' | 'area' | 'bar'
  showLegend?: boolean
}): JSX.Element {
  const [hoverTs, setHoverTs] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const prepared: Prepared[] = useMemo(
    () =>
      series.map((s, i) => ({
        label: s.label,
        color: slotColor(s.slot ?? i + 1),
        pts: s.points
          .map((p) => ({ t: tsOf(p.ts), v: p.value }))
          .filter((p) => !Number.isNaN(p.t))
          .sort((a, b) => a.t - b.t),
      })),
    [series],
  )

  const model = useMemo(() => {
    const populated = prepared.filter((s) => s.pts.length > 0)
    if (populated.length === 0) return null
    const allTs = [...new Set(populated.flatMap((s) => s.pts.map((p) => p.t)))].sort((a, b) => a - b)
    const tMin = allTs[0]
    const tMax = allTs[allTs.length - 1]
    const vMax = Math.max(...populated.flatMap((s) => s.pts.map((p) => p.v)))
    const { max, ticks } = niceScale(vMax)
    // median gap between consecutive timestamps = the bucket width (for bars)
    const gaps = allTs.slice(1).map((t, i) => t - allTs[i]).sort((a, b) => a - b)
    const bucketMs = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : 3_600_000
    return { allTs, tMin, tMax: tMax === tMin ? tMin + 1 : tMax, vMax: max, ticks, bucketMs }
  }, [prepared])

  const legendOn = showLegend ?? series.length >= 2
  const legend = legendOn && (
    <div className="chart-legend">
      {prepared.map((s) => (
        <span key={s.label} className="legend-item">
          <span className="legend-chip" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )

  if (width < 40 || height < 40) return <span aria-hidden="true" />
  if (!model) return <div className="quiet">no data yet</div>

  // direct labels at line ends: only for 2-4 line/area series with room to spare
  const directLabels = kind !== 'bar' && series.length >= 2 && series.length <= 4 && width > 300
  const labelGutter = directLabels
    ? Math.min(76, Math.max(...prepared.map((s) => s.label.length)) * 6 + 14)
    : 0

  const legendH = legendOn ? 22 : 0
  // left gutter sized to the widest tick label (11px mono ≈ 6.6px/char) so
  // values like "1000 ms" or "1.9 GiB" are never clipped
  const maxTickChars = Math.max(...model.ticks.map((v) => fmtValue(v, unit).length), 1)
  const pad = { top: 8, right: 10 + labelGutter, bottom: 18, left: Math.min(78, 12 + maxTickChars * 6.6) }
  const plotW = Math.max(width - pad.left - pad.right, 10)
  const plotH = Math.max(height - legendH - pad.top - pad.bottom, 10)
  const baseline = pad.top + plotH

  // bar mode reserves half a bucket on each side so end bars stay inside the plot
  const barPad = kind === 'bar' ? model.bucketMs / 2 : 0
  const tSpan = model.tMax - model.tMin + barPad * 2
  const x = (t: number) => pad.left + ((t - model.tMin + barPad) / tSpan) * plotW
  const y = (v: number) => pad.top + plotH - (v / model.vMax) * plotH

  // ---- marks ----
  const linePaths =
    kind !== 'bar'
      ? prepared.map((s) => {
          const xy = s.pts.map((p) => ({ x: x(p.t), y: y(p.v) }))
          const line = monotonePath(xy)
          const area =
            xy.length > 1
              ? `${line} L ${xy[xy.length - 1].x.toFixed(2)} ${baseline} L ${xy[0].x.toFixed(2)} ${baseline} Z`
              : ''
          return { ...s, line, area, lastXY: xy[xy.length - 1] }
        })
      : []

  const nSeries = Math.max(prepared.length, 1)
  const bucketW = (model.bucketMs / tSpan) * plotW
  // 2px surface gaps between adjacent bars AND between series groups
  const groupW = Math.max(bucketW - 2, 2)
  const barW = Math.max((groupW - 2 * (nSeries - 1)) / nSeries, 1.5)
  const bars =
    kind === 'bar'
      ? prepared.flatMap((s, si) =>
          s.pts
            .filter((p) => p.v > 0)
            .map((p) => ({
              key: `${si}:${p.t}`,
              d: roundedBarPath(x(p.t) - groupW / 2 + si * (barW + 2), y(p.v), barW, baseline),
              color: s.color,
            })),
        )
      : []

  // ---- axes ----
  const span = model.tMax - model.tMin
  const xTickCount = plotW > 420 ? 5 : plotW > 220 ? 4 : 3
  const xTicks = Array.from({ length: xTickCount }, (_, i) => model.tMin + (span * i) / (xTickCount - 1))

  // ---- direct labels: nudge apart vertically so they never collide ----
  const endLabels = directLabels
    ? (() => {
        const raw = linePaths
          .filter((s) => s.lastXY)
          .map((s) => ({ label: s.label, color: s.color, x: s.lastXY!.x, y: s.lastXY!.y }))
          .sort((a, b) => a.y - b.y)
        for (let i = 1; i < raw.length; i++) {
          if (raw[i].y - raw[i - 1].y < 12) raw[i].y = raw[i - 1].y + 12
        }
        return raw
      })()
    : []

  // ---- hover ----
  const hover =
    hoverTs != null
      ? {
          ts: hoverTs,
          px: x(hoverTs),
          rows: prepared.map((s) => ({
            label: s.label,
            color: s.color,
            value: s.pts.find((p) => p.t === hoverTs)?.v,
          })),
        }
      : null

  function nearestTs(clientX: number): number | null {
    const svg = svgRef.current
    if (!svg) return null
    const px = clientX - svg.getBoundingClientRect().left
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
          {model.ticks.map((v) => (
            <g key={v}>
              <line
                x1={pad.left}
                x2={pad.left + plotW}
                y1={y(v)}
                y2={y(v)}
                className={v === 0 ? 'chart-baseline' : 'chart-grid'}
              />
              <text x={pad.left - 6} y={y(v) + 3} className="chart-tick" fill="var(--text-2)" textAnchor="end">
                {fmtValue(v, unit)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text
              key={t}
              x={x(t)}
              y={baseline + 13}
              className="chart-tick"
              fill="var(--text-2)"
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
            >
              {fmtTimeTick(t, span)}
            </text>
          ))}

          {kind === 'area' &&
            linePaths.map((s, i) => <path key={`a${i}`} d={s.area} fill={s.color} opacity={0.12} stroke="none" />)}
          {kind !== 'bar' &&
            linePaths.map((s, i) => (
              <path
                key={`l${i}`}
                d={s.line}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          {kind === 'bar' && bars.map((b) => <path key={b.key} d={b.d} fill={b.color} stroke="none" />)}

          {/* direct labels at line ends — ink text, chip carries the color */}
          {endLabels.map((l) => (
            <g key={l.label}>
              <rect x={l.x + 6} y={l.y - 4} width={7} height={7} rx={1.5} fill={l.color} />
              <text x={l.x + 17} y={l.y + 3} className="chart-direct-label" fill="var(--text)">
                {l.label}
              </text>
            </g>
          ))}

          {hover && (
            <g>
              <line x1={hover.px} x2={hover.px} y1={pad.top} y2={baseline} className="chart-crosshair" />
              {kind !== 'bar' &&
                hover.rows.map(
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
                <span className="legend-chip" style={{ background: r.color }} />
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

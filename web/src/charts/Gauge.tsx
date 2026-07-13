import type { JSX } from 'react'
import { fmtValue } from '../format'
import { arcPath, seqColor } from './util'

/**
 * 270° radial instrument. Track = chart grid; fill wears the SEQUENTIAL ramp
 * (magnitude, one hue) — unless thresholds are given, in which case the fill
 * wears the status band color WITH the band's label text next to the value
 * (state is never told by color alone). Big mono value centered.
 */

const START = -135
const SWEEP = 270

interface Band {
  color: string
  label: string
}

function bandFor(value: number, thresholds: { warn: number; critical: number }): Band {
  if (value >= thresholds.critical) return { color: 'var(--down)', label: 'CRITICAL' }
  if (value >= thresholds.warn) return { color: 'var(--warn)', label: 'WARN' }
  return { color: 'var(--ok)', label: 'OK' }
}

export function Gauge({
  value,
  max,
  label,
  unit,
  width,
  height,
  thresholds,
}: {
  value: number | null
  max: number
  label: string
  unit?: string
  width: number
  height: number
  thresholds?: { warn: number; critical: number }
}): JSX.Element {
  if (width < 60 || height < 60) return <span aria-hidden="true" />

  const labelH = 18
  const boxH = height - labelH
  // the 270° arc spans vertically from cy-r to cy+r·sin45 — size r to fit both axes
  const r = Math.max(Math.min((width - 16) / 2, (boxH - 10) / 1.72), 20)
  const stroke = Math.max(6, Math.min(12, r * 0.16))
  const cx = width / 2
  const cy = 5 + stroke / 2 + r
  const svgH = Math.min(boxH, cy + r * 0.72 + stroke)

  const safeMax = max > 0 ? max : 1
  const frac = value == null ? 0 : Math.min(Math.max(value / safeMax, 0), 1)
  const band = value != null && thresholds ? bandFor(value, thresholds) : null
  const fillColor = band ? band.color : seqColor(frac)
  const fillSweep = SWEEP * frac

  // threshold tick marks on the track, so the bands are legible before alarm
  const ticks = thresholds
    ? [thresholds.warn, thresholds.critical]
        .filter((t) => t > 0 && t < safeMax)
        .map((t) => START + SWEEP * (t / safeMax))
    : []

  return (
    <div className="gauge" style={{ width, height }} role="img" aria-label={`${label}: ${value != null ? fmtValue(value, unit) : 'no data'}${band ? ` (${band.label})` : ''}`}>
      <svg width={width} height={svgH}>
        <path
          d={arcPath(cx, cy, r, START, START + SWEEP)}
          fill="none"
          stroke="var(--chart-grid)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {value != null && fillSweep > 0.5 && (
          <path
            d={arcPath(cx, cy, r, START, START + fillSweep)}
            fill="none"
            stroke={fillColor}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
        {ticks.map((a) => {
          const rad = ((a - 90) * Math.PI) / 180
          const r0 = r - stroke / 2 - 3
          const r1 = r + stroke / 2 + 3
          return (
            <line
              key={a}
              x1={cx + r0 * Math.cos(rad)}
              y1={cy + r0 * Math.sin(rad)}
              x2={cx + r1 * Math.cos(rad)}
              y2={cy + r1 * Math.sin(rad)}
              stroke="var(--chart-baseline)"
              strokeWidth={1.5}
            />
          )
        })}
      </svg>
      <div className="gauge-center" style={{ left: 0, right: 0, top: cy - r * 0.42 }}>
        <span className="gauge-value" style={{ fontSize: Math.max(15, Math.min(28, r * 0.42)) }}>
          {value != null ? fmtValue(value, unit) : '—'}
        </span>
        {band && (
          <span className="gauge-band" style={{ color: band.color }}>
            {band.label}
          </span>
        )}
        {!band && value != null && (
          <span className="gauge-max">of {fmtValue(safeMax, unit)}</span>
        )}
      </div>
      <span className="gauge-label">{label}</span>
    </div>
  )
}

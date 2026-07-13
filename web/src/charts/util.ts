/** Shared chart math — scales, paths, slot colors. No React in here. */

export interface XY {
  x: number
  y: number
}

/** Categorical slot (1-8) → the fixed token color. Never cycled, never generated. */
export function slotColor(slot: number): string {
  const n = Math.min(Math.max(Math.round(slot), 1), 8)
  return `var(--series-${n})`
}

/** Sequential ramp step for a 0..1 magnitude (one hue — never status colors). */
export function seqColor(fraction: number): string {
  const f = Math.min(Math.max(fraction, 0), 1)
  // dark theme: the ramp runs dim -> bright; start at step 4 so the fill
  // always clears 3:1 against the card surface
  const step = 4 + Math.min(3, Math.floor(f * 4))
  return `var(--seq-${step})`
}

/** Fritsch–Carlson monotone cubic — smooth but never overshoots the data. */
export function monotonePath(points: XY[]): string {
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
export function niceScale(maxValue: number, tickCount = 4): { max: number; ticks: number[] } {
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

/** A bar with 4px-rounded top corners, anchored square on the baseline. */
export function roundedBarPath(x: number, y: number, w: number, baseline: number, radius = 4): string {
  const h = baseline - y
  if (h <= 0 || w <= 0) return ''
  const r = Math.min(radius, w / 2, h)
  return [
    `M ${x.toFixed(2)} ${baseline.toFixed(2)}`,
    `L ${x.toFixed(2)} ${(y + r).toFixed(2)}`,
    `A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${(x + r).toFixed(2)} ${y.toFixed(2)}`,
    `L ${(x + w - r).toFixed(2)} ${y.toFixed(2)}`,
    `A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${(x + w).toFixed(2)} ${(y + r).toFixed(2)}`,
    `L ${(x + w).toFixed(2)} ${baseline.toFixed(2)}`,
    'Z',
  ].join(' ')
}

export function polarXY(cx: number, cy: number, r: number, angleDeg: number): XY {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/** Circular arc (for stroking) from a0 to a1, degrees clockwise from 12 o'clock. */
export function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const start = polarXY(cx, cy, r, a0)
  const end = polarXY(cx, cy, r, a1)
  const sweep = a1 - a0
  const large = sweep > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

export function tsOf(ts: string): number {
  return new Date(ts).getTime()
}

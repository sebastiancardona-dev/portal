import type { JSX } from 'react'
import type { Point } from '../api/types'
import { monotonePath } from './util'

/** Tiny inline trend — de-emphasized stroke, dot on the latest value. */
export function Sparkline({
  points,
  width,
  height,
}: {
  points: Point[]
  width: number
  height: number
}): JSX.Element {
  const pts = points
    .map((p) => ({ t: new Date(p.ts).getTime(), v: p.value }))
    .filter((p) => !Number.isNaN(p.t))
    .sort((a, b) => a.t - b.t)
  if (pts.length < 2 || width < 20 || height < 10) return <span aria-hidden="true" />
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
      <path
        d={monotonePath(xy)}
        fill="none"
        stroke="color-mix(in srgb, var(--series-1) 75%, transparent)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r={2.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  )
}

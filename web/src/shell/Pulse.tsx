import { useApps, useSeries } from '../api/hooks'
import type { Point } from '../api/types'
import { fmtPct } from '../format'
import { StatusDot, type StatusState } from '../ui'

const W = 140
const H = 26
const PAD = 2

/**
 * The signature element of the portal: a slim live strip in the topbar —
 * a 30-minute host-CPU sparkline (the EKG of the VPS) + an "N/N UP" chip.
 * Self-contained SVG on purpose: the topbar must never depend on charts/.
 */
function SparkPath({ points }: { points: Point[] }) {
  const values = points.map((p) => p.value)
  const t0 = new Date(points[0].ts).getTime()
  const t1 = new Date(points[points.length - 1].ts).getTime()
  const span = Math.max(t1 - t0, 1)
  // headroom above the busiest sample so the trace never kisses the frame
  const yMax = Math.max(Math.max(...values) * 1.15, 5)

  const coords = points.map((p) => {
    const x = PAD + ((new Date(p.ts).getTime() - t0) / span) * (W - PAD * 2)
    const y = H - PAD - (Math.max(p.value, 0) / yMax) * (H - PAD * 2)
    return [x, y] as const
  })
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)} ${H - PAD} L${coords[0][0].toFixed(1)} ${H - PAD} Z`

  return (
    <>
      <path d={area} fill="var(--accent)" opacity={0.08} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </>
  )
}

export function Pulse() {
  const cpu = useSeries('host:cpu_pct', '30m', '1m')
  const apps = useApps()

  const points = cpu.data ?? []
  const last = points.length > 0 ? points[points.length - 1].value : null

  const total = apps.data?.length ?? 0
  const upCount = apps.data?.filter(
    (a) => a.environments.length > 0 && a.environments.every((e) => e.up === true),
  ).length ?? 0
  const anyDown = apps.data?.some((a) => a.environments.some((e) => e.up === false)) ?? false
  const chip: StatusState = !apps.data || total === 0 ? 'off' : anyDown ? 'down' : upCount === total ? 'ok' : 'off'

  return (
    <div className="pulse">
      <span className="pulse-eyebrow">cpu</span>
      <svg
        className="pulse-spark"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          last == null
            ? 'Host CPU sparkline — no data yet'
            : `Host CPU over the last 30 minutes, now ${fmtPct(last)}`
        }
      >
        <title>host CPU · last 30 min</title>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--chart-baseline)" strokeWidth="1" />
        {points.length > 1 && <SparkPath points={points} />}
      </svg>
      <span className="pulse-value">{last == null ? '—' : fmtPct(last)}</span>
      <span className="pulse-sep" aria-hidden="true" />
      <StatusDot
        state={chip}
        label={apps.data ? `${upCount}/${total} UP` : '—/— UP'}
        title="apps fully up / apps discovered"
      />
    </div>
  )
}

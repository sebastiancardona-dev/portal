/** Formatting helpers — units, compact numbers, relative time. */

const KIB = 1024
const MIB = KIB * 1024
const GIB = MIB * 1024
const TIB = GIB * 1024

export function fmtBytes(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= TIB) return `${(n / TIB).toFixed(2)} TiB`
  if (abs >= GIB) return `${(n / GIB).toFixed(1)} GiB`
  if (abs >= MIB) return `${(n / MIB).toFixed(0)} MiB`
  if (abs >= KIB) return `${(n / KIB).toFixed(0)} KiB`
  return `${Math.round(n)} B`
}

export function fmtMs(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)} s`
  if (Math.abs(n) >= 100) return `${Math.round(n)} ms`
  return `${n.toFixed(n >= 10 ? 0 : 1)} ms`
}

export function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n >= 100 ? Math.round(n) : n.toFixed(1)}%`
}

export function fmtNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${(n / 1000).toFixed(1)}K`
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toFixed(abs < 10 ? 2 : 1)
}

/** Unit strings come from the sources API — normalize the ones we know. */
export function fmtValue(value: number, unit: string | undefined): string {
  switch ((unit ?? '').toLowerCase()) {
    case 'bytes':
    case 'b':
      return fmtBytes(value)
    case 'ms':
      return fmtMs(value)
    case '%':
    case 'pct':
    case 'percent':
      return fmtPct(value)
    default:
      return unit ? `${fmtNumber(value)} ${unit}` : fmtNumber(value)
  }
}

export function fmtAbsolute(ts: string | number | Date): string {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

export function fmtRelative(ts: string | number | Date, now = Date.now()): string {
  const d = new Date(ts).getTime()
  if (Number.isNaN(d)) return '—'
  const diff = now - d
  if (diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/** Axis tick label for a time value, scaled to the visible span. */
export function fmtTimeTick(ms: number, spanMs: number): string {
  const d = new Date(ms)
  if (spanMs > 48 * 3600_000) {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : '—'
}

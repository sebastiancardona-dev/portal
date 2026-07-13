import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { fmtAbsolute, fmtRelative } from './format'

/** Live content-box size of a div — page charts size themselves off this. */
export function useMeasure(): [RefObject<HTMLDivElement | null>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}

/** UP/DOWN pill — status color never carries meaning alone, the label does.
 *  null = never probed yet (an env without a discovered URL): neutral pill. */
export function StatusPill({ up }: { up: boolean | null }) {
  if (up == null) {
    return (
      <span className="pill pill-unknown">
        <span className="pill-dot" aria-hidden="true" />
        N/A
      </span>
    )
  }
  return (
    <span className={`pill ${up ? 'pill-up' : 'pill-down'}`}>
      <span className="pill-dot" aria-hidden="true" />
      {up ? 'UP' : 'DOWN'}
    </span>
  )
}

export function EnvBadge({ env }: { env: string }) {
  return <span className={`env-badge env-${env.toLowerCase()}`}>{env}</span>
}

/** Relative timestamp ("3m ago") with the absolute time on hover. */
export function RelTime({ ts }: { ts: string | null | undefined }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!ts) return <span className="muted">—</span>
  return (
    <time dateTime={ts} title={fmtAbsolute(ts)}>
      {fmtRelative(ts)}
    </time>
  )
}

export function Skeleton({ height = 20, width }: { height?: number; width?: string }) {
  return <span className="skeleton" style={{ height, width: width ?? '100%' }} aria-hidden="true" />
}

/** Quiet placeholder for empty/missing data — never a crash, never a spinner farm. */
export function Quiet({ children }: { children: ReactNode }) {
  return <div className="quiet">{children}</div>
}

interface SortColumn<T> {
  key: string
  label: string
  /** value used for sorting */
  get: (row: T) => string | number
  /** rendered cell (defaults to String(get(row))) */
  render?: (row: T) => ReactNode
  align?: 'left' | 'right'
  mono?: boolean
}

/** Small sortable table — used by the table widget and the detail pages. */
export function SortTable<T>({
  columns,
  rows,
  rowKey,
  defaultSort,
}: {
  columns: SortColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
}) {
  const [sort, setSort] = useState(defaultSort ?? { key: columns[0]?.key ?? '', dir: 'asc' as const })

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const mul = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = col.get(a)
      const vb = col.get(b)
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul
      return String(va).localeCompare(String(vb)) * mul
    })
  }, [rows, columns, sort])

  function toggle(key: string) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.align === 'right' ? 'right' : undefined}
                aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <button type="button" className="th-sort" onClick={() => toggle(c.key)}>
                  {c.label}
                  <span className="sort-arrow" aria-hidden="true">
                    {sort.key === c.key ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={[c.align === 'right' ? 'right' : '', c.mono ? 'mono' : ''].join(' ').trim() || undefined}
                >
                  {c.render ? c.render(row) : String(c.get(row))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A widget that throws must never take the dashboard down with it. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) return <Quiet>something went wrong here</Quiet>
    return this.props.children
  }
}

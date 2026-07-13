import { useHost, useSeries } from '../api/hooks'
import type { Point } from '../api/types'
import { fmtBytes, fmtPct } from '../format'
import { Quiet, RelTime, Skeleton, SortTable, useMeasure } from '../ui'
import { SeriesChart } from '../widgets/SeriesChart'

function meterClass(pct: number): string {
  if (pct >= 92) return 'meter-crit'
  if (pct >= 80) return 'meter-warn'
  return 'meter-ok'
}

function HostTile({
  label,
  value,
  used,
  total,
}: {
  label: string
  value: string
  used?: number | null
  total?: number | null
}) {
  const pct = used != null && total ? (used / total) * 100 : null
  return (
    <div className="panel stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {pct != null && (
        <>
          <div className="meter" role="presentation">
            <div className={`meter-fill ${meterClass(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className="stat-sub mono">{fmtPct(pct)} of {fmtBytes(total!)}</span>
        </>
      )}
    </div>
  )
}

function HostChart({ title, unit, query }: { title: string; unit: string; query: { data?: Point[]; isPending: boolean; isError: boolean } }) {
  const [ref, size] = useMeasure()
  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      <div ref={ref} className="panel-chart">
        {query.isPending ? (
          <Skeleton height={200} />
        ) : query.isError || !query.data || query.data.length === 0 ? (
          <Quiet>no data yet</Quiet>
        ) : (
          size.width > 0 && (
            <SeriesChart series={[{ label: title, points: query.data }]} width={size.width} height={220} unit={unit} />
          )
        )}
      </div>
    </section>
  )
}

export function HostPage() {
  const host = useHost()
  const cpuSeries = useSeries('host:cpu_pct', '6h', '5m')
  const memSeries = useSeries('host:mem_used_bytes', '6h', '5m')

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Host</h1>
        {host.data && (
          <span className="muted">
            snapshot <RelTime ts={host.data.ts} />
          </span>
        )}
      </header>

      {host.isPending ? (
        <div className="tile-row">
          <Skeleton height={120} />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      ) : host.isError ? (
        <Quiet>no host metrics yet — the collector may still be warming up</Quiet>
      ) : (
        <div className="tile-row">
          <HostTile label="CPU" value={fmtPct(host.data.cpuPct)} />
          <HostTile
            label="Memory"
            value={fmtBytes(host.data.memUsedBytes)}
            used={host.data.memUsedBytes}
            total={host.data.memTotalBytes}
          />
          <HostTile
            label="Disk"
            value={fmtBytes(host.data.diskUsedBytes)}
            used={host.data.diskUsedBytes}
            total={host.data.diskTotalBytes}
          />
        </div>
      )}

      <div className="panel-row">
        <HostChart title="CPU · 6h" unit="%" query={cpuSeries} />
        <HostChart title="Memory used · 6h" unit="bytes" query={memSeries} />
      </div>

      <section className="panel">
        <h2 className="panel-title">Containers</h2>
        {host.isPending ? (
          <Skeleton height={120} />
        ) : host.isError || host.data.containers.length === 0 ? (
          <Quiet>no per-container stats yet</Quiet>
        ) : (
          <SortTable
            rows={host.data.containers}
            rowKey={(c) => c.name}
            defaultSort={{ key: 'mem', dir: 'desc' }}
            columns={[
              { key: 'name', label: 'Container', get: (c) => c.name, mono: true },
              { key: 'cpu', label: 'CPU', get: (c) => c.cpuPct, render: (c) => fmtPct(c.cpuPct), align: 'right', mono: true },
              { key: 'mem', label: 'Memory', get: (c) => c.memBytes, render: (c) => fmtBytes(c.memBytes), align: 'right', mono: true },
            ]}
          />
        )}
      </section>
    </>
  )
}

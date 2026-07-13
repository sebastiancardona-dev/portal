import { useHost, useSeries } from '../api/hooks'
import type { Point } from '../api/types'
import { Donut, Gauge, TimeSeriesChart } from '../charts'
import { fmtBytes, fmtPct } from '../format'
import { Quiet, RelTime, Skeleton, SortTable, useMeasure } from '../ui'

function meterClass(pct: number): string {
  if (pct >= 92) return 'meter-crit'
  if (pct >= 80) return 'meter-warn'
  return 'meter-ok'
}

function MeterTile({
  label,
  value,
  used,
  total,
  footnote,
  footnoteTitle,
  absent,
}: {
  label: string
  value: string
  used?: number | null
  total?: number | null
  footnote?: string
  footnoteTitle?: string
  /** data deliberately not collected here — say so instead of inventing numbers */
  absent?: boolean
}) {
  const pct = used != null && total ? (used / total) * 100 : null
  return (
    <div className="panel metric-tile">
      <span className="eyebrow">{label}</span>
      {absent ? (
        <span className="metric-absent">Not measured in this environment</span>
      ) : (
        <>
          <span className="metric-value">{value}</span>
          {pct != null && (
            <>
              <div className="meter" role="presentation">
                <div className={`meter-fill ${meterClass(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <span className="metric-sub">
                {fmtPct(pct)} of {fmtBytes(total!)}
              </span>
            </>
          )}
          {footnote && (
            <span className="metric-note" title={footnoteTitle}>
              {footnote}
            </span>
          )}
        </>
      )}
    </div>
  )
}

function CpuGauge({ cpuPct }: { cpuPct: number | null }) {
  const [ref, size] = useMeasure()
  return (
    <div className="panel metric-tile" ref={ref}>
      <span className="eyebrow">CPU</span>
      {cpuPct == null ? (
        <Quiet>no data yet</Quiet>
      ) : (
        size.width > 0 && (
          <Gauge
            value={cpuPct}
            max={100}
            label="CPU"
            unit="%"
            width={size.width}
            height={110}
            thresholds={{ warn: 80, critical: 92 }}
          />
        )
      )}
    </div>
  )
}

function HostChart({
  title,
  unit,
  query,
}: {
  title: string
  unit: string
  query: { data?: Point[]; isPending: boolean; isError: boolean }
}) {
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
            <TimeSeriesChart
              series={[{ label: title, points: query.data }]}
              width={size.width}
              height={220}
              unit={unit}
              kind="area"
            />
          )
        )}
      </div>
    </section>
  )
}

function MemoryDonut({ containers }: { containers: { name: string; memBytes: number }[] }) {
  const [ref, size] = useMeasure()
  return (
    <section className="panel">
      <h2 className="panel-title">Memory share</h2>
      <div ref={ref} className="panel-chart">
        {containers.length === 0 ? (
          <Quiet>no per-container stats yet</Quiet>
        ) : (
          size.width > 0 && (
            <Donut
              parts={containers.map((c) => ({ label: c.name, value: c.memBytes }))}
              width={size.width}
              height={220}
              unit="bytes"
              totalLabel="all containers"
            />
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
        <div className="page-id">
          <span className="eyebrow">Host · VPS</span>
          <h1 className="page-title">Host</h1>
        </div>
        {host.data && (
          <span className="page-meta">
            snapshot <RelTime ts={host.data.ts} />
          </span>
        )}
      </header>

      {host.isPending ? (
        <div className="tile-row">
          <Skeleton height={130} />
          <Skeleton height={130} />
          <Skeleton height={130} />
        </div>
      ) : host.isError ? (
        <Quiet>no host metrics yet — the collector may still be warming up</Quiet>
      ) : (
        <div className="tile-row">
          <CpuGauge cpuPct={host.data.cpuPct} />
          <MeterTile
            label="Memory"
            value={fmtBytes(host.data.memUsedBytes)}
            used={host.data.memUsedBytes}
            total={host.data.memTotalBytes}
          />
          <MeterTile
            label="Disk"
            value={fmtBytes(host.data.diskUsedBytes)}
            used={host.data.diskUsedBytes}
            total={host.data.diskTotalBytes}
            absent={host.data.diskUsedBytes == null}
            footnote={
              host.data.diskPath
                ? host.data.diskPath === '/data/deploy/state'
                  ? 'root disk (/)'
                  : host.data.diskPath
                : undefined
            }
            footnoteTitle="usage of the filesystem containing the deploy state — on the VPS this is the root disk"
          />
        </div>
      )}

      <div className="panel-row">
        <HostChart title="CPU · 6h" unit="%" query={cpuSeries} />
        <HostChart title="Memory used · 6h" unit="bytes" query={memSeries} />
      </div>

      <div className="panel-row">
        <MemoryDonut containers={(host.data?.containers ?? []).filter((c) => c.memBytes != null)} />
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
      </div>
    </>
  )
}

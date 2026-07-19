import type { JSX, ReactNode } from 'react'

/**
 * Static gallery vignettes — one tiny canned-data SVG per widget type.
 * Token colors only, no fetching, no interactivity: these exist purely so the
 * add-widget gallery can SHOW each widget instead of describing it.
 *
 * RULE: every <text> node carries an explicit fill from an ink token —
 * SVG text without a fill defaults to BLACK and vanishes on a dark surface.
 */

function Vignette({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 150 90" className="widget-preview" aria-label={`${label} preview`} role="img">
      {children}
    </svg>
  )
}

const grid = (
  <g stroke="var(--chart-grid)" strokeOpacity={0.6} strokeWidth={1}>
    <line x1={10} x2={140} y1={26} y2={26} />
    <line x1={10} x2={140} y1={48} y2={48} />
  </g>
)

const baseline = <line x1={10} x2={140} y1={70} y2={70} stroke="var(--chart-baseline)" strokeWidth={1} />

export function StatTilePreview(): JSX.Element {
  return (
    <Vignette label="Stat tile">
      <rect x={14} y={16} width={44} height={5} rx={2.5} fill="var(--text-2)" opacity={0.6} />
      <text x={14} y={48} fontFamily="var(--font-mono)" fontWeight={600} fontSize={24} fill="var(--text)">
        42.7%
      </text>
      {/* delta: small up-arrow glyph drawn as a path, never a text glyph */}
      <path d="M 16 61 L 19 56.5 L 22 61 Z" fill="var(--text-2)" />
      <rect x={26} y={57} width={38} height={4.5} rx={2.25} fill="var(--text-2)" opacity={0.55} />
      <path
        d="M 14 78 C 30 76, 40 72, 56 74 C 72 76, 84 68, 100 70 C 112 71, 122 66, 134 64"
        fill="none"
        stroke="color-mix(in srgb, var(--series-1) 75%, transparent)"
        strokeWidth={1.5}
      />
      <circle cx={134} cy={64} r={2.5} fill="var(--series-1)" />
    </Vignette>
  )
}

export function LineChartPreview(): JSX.Element {
  return (
    <Vignette label="Line chart">
      {grid}
      {baseline}
      <path
        d="M 10 58 C 26 52, 36 40, 52 42 C 68 44, 78 28, 94 30 C 110 32, 124 22, 140 24"
        fill="none"
        stroke="var(--series-1)"
        strokeWidth={2}
      />
      <path
        d="M 10 66 C 26 64, 36 58, 52 60 C 68 62, 78 52, 94 54 C 110 56, 124 46, 140 50"
        fill="none"
        stroke="var(--series-2)"
        strokeWidth={2}
      />
      <rect x={10} y={10} width={7} height={7} rx={1.5} fill="var(--series-1)" />
      <rect x={40} y={10} width={7} height={7} rx={1.5} fill="var(--series-2)" />
      <rect x={20} y={11} width={14} height={5} rx={2.5} fill="var(--text-2)" opacity={0.55} />
      <rect x={50} y={11} width={14} height={5} rx={2.5} fill="var(--text-2)" opacity={0.55} />
    </Vignette>
  )
}

export function BarChartPreview(): JSX.Element {
  const bars = [34, 18, 42, 26, 50, 22, 38]
  return (
    <Vignette label="Bar chart">
      {grid}
      {baseline}
      {bars.map((h, i) => {
        const x = 14 + i * 18
        const y = 70 - h
        return (
          <path
            key={i}
            d={`M ${x} 70 L ${x} ${y + 4} A 4 4 0 0 1 ${x + 4} ${y} L ${x + 8} ${y} A 4 4 0 0 1 ${x + 12} ${y + 4} L ${x + 12} 70 Z`}
            fill="var(--series-1)"
          />
        )
      })}
    </Vignette>
  )
}

export function GaugePreview(): JSX.Element {
  // 270° arc centered at (75,48), r=30: from -135° to +135°
  return (
    <Vignette label="Gauge">
      <path
        d="M 53.8 69.2 A 30 30 0 1 1 96.2 69.2"
        fill="none"
        stroke="var(--chart-grid)"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path
        d="M 53.8 69.2 A 30 30 0 0 1 89.9 21.9"
        fill="none"
        stroke="var(--seq-5)"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <text
        x={75}
        y={52}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontWeight={600}
        fontSize={15}
        fill="var(--text)"
      >
        61%
      </text>
      <rect x={57} y={78} width={36} height={5} rx={2.5} fill="var(--text-2)" opacity={0.6} />
    </Vignette>
  )
}

export function DonutPreview(): JSX.Element {
  // three segments with visible surface gaps
  return (
    <Vignette label="Donut">
      <g fill="none" strokeWidth={10}>
        <path d="M 45 15 A 30 30 0 0 1 67.98 64.29" stroke="var(--series-1)" />
        <path d="M 64.29 67.98 A 30 30 0 0 1 16.81 55.26" stroke="var(--series-2)" />
        <path d="M 15.45 50.21 A 30 30 0 0 1 39.79 15.46" stroke="var(--series-3)" />
      </g>
      <text
        x={45}
        y={49}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontWeight={600}
        fontSize={11}
        fill="var(--text)"
      >
        1.9G
      </text>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={96} y={26 + i * 15} width={7} height={7} rx={1.5} fill={`var(--series-${i + 1})`} />
          <rect x={108} y={27 + i * 15} width={30 - i * 6} height={5} rx={2.5} fill="var(--text-2)" opacity={0.55} />
        </g>
      ))}
    </Vignette>
  )
}

export function UptimeHeatmapPreview(): JSX.Element {
  const states = [
    'ok', 'ok', 'ok', 'ok', 'warn', 'ok', 'ok', 'ok', 'down', 'ok', 'ok', 'ok', 'ok', 'warn', 'ok', 'ok',
  ]
  const fill: Record<string, string> = {
    ok: 'color-mix(in srgb, var(--ok) 45%, transparent)',
    warn: 'color-mix(in srgb, var(--warn) 55%, transparent)',
    down: 'color-mix(in srgb, var(--down) 65%, transparent)',
  }
  return (
    <Vignette label="Uptime heatmap">
      <rect x={12} y={20} width={40} height={5} rx={2.5} fill="var(--text-2)" opacity={0.6} />
      {states.map((s, i) => (
        <rect key={i} x={12 + i * 8} y={36} width={6} height={22} rx={1.5} fill={fill[s]} />
      ))}
      <rect x={12} y={70} width={6} height={6} rx={1.5} fill={fill.ok} />
      <rect x={38} y={70} width={6} height={6} rx={1.5} fill={fill.warn} />
      <rect x={64} y={70} width={6} height={6} rx={1.5} fill={fill.down} />
      <rect x={21} y={71} width={12} height={4} rx={2} fill="var(--text-2)" opacity={0.45} />
      <rect x={47} y={71} width={12} height={4} rx={2} fill="var(--text-2)" opacity={0.45} />
      <rect x={73} y={71} width={12} height={4} rx={2} fill="var(--text-2)" opacity={0.45} />
    </Vignette>
  )
}

export function DeployFeedPreview(): JSX.Element {
  return (
    <Vignette label="Deploy feed">
      {[0, 1, 2, 3].map((i) => {
        const y = 16 + i * 18
        return (
          <g key={i}>
            <rect x={12} y={y} width={22} height={6} rx={3} fill="var(--text-2)" opacity={0.45} />
            <rect x={40} y={y - 1} width={20} height={8} rx={2} fill="none" stroke="var(--border-strong)" strokeWidth={1} />
            <rect x={66} y={y} width={i % 2 ? 46 : 60} height={6} rx={3} fill="var(--text-2)" opacity={0.65} />
          </g>
        )
      })}
      <g stroke="var(--chart-grid)" strokeOpacity={0.6} strokeWidth={1}>
        <line x1={12} x2={138} y1={31} y2={31} />
        <line x1={12} x2={138} y1={49} y2={49} />
        <line x1={12} x2={138} y1={67} y2={67} />
      </g>
    </Vignette>
  )
}

export function ReleasesPreview(): JSX.Element {
  return (
    <Vignette label="Recent releases">
      {[0, 1, 2, 3].map((i) => {
        const y = 16 + i * 18
        return (
          <g key={i}>
            <rect x={12} y={y} width={20} height={6} rx={3} fill="var(--text-2)" opacity={0.45} />
            {/* the version tag, mono-ish block */}
            <rect x={38} y={y} width={28} height={6} rx={3} fill="var(--text-2)" opacity={0.7} />
            {/* deployed badge on some rows */}
            {i % 2 === 0 && (
              <rect x={74} y={y - 1} width={22} height={8} rx={2} fill="none" stroke="var(--ok)" strokeOpacity={0.6} strokeWidth={1} />
            )}
            <rect x={106} y={y} width={26} height={6} rx={3} fill="var(--text-2)" opacity={0.4} />
          </g>
        )
      })}
      <g stroke="var(--chart-grid)" strokeOpacity={0.6} strokeWidth={1}>
        <line x1={12} x2={138} y1={31} y2={31} />
        <line x1={12} x2={138} y1={49} y2={49} />
        <line x1={12} x2={138} y1={67} y2={67} />
      </g>
    </Vignette>
  )
}

export function StatusListPreview(): JSX.Element {
  const rows = [
    { dot: 'var(--ok)', lit: true },
    { dot: 'var(--ok)', lit: true },
    { dot: 'var(--down)', lit: true },
    { dot: 'var(--status-unknown)', lit: false },
  ]
  return (
    <Vignette label="App status">
      {rows.map((r, i) => {
        const y = 18 + i * 18
        return (
          <g key={i}>
            {r.lit ? (
              <>
                <circle cx={18} cy={y + 3} r={6} fill={r.dot} opacity={0.22} />
                <circle cx={18} cy={y + 3} r={3.5} fill={r.dot} />
              </>
            ) : (
              <circle cx={18} cy={y + 3} r={3} fill="none" stroke={r.dot} strokeWidth={1.5} />
            )}
            <rect x={30} y={y} width={44} height={6} rx={3} fill="var(--text-2)" opacity={0.65} />
            <rect x={94} y={y} width={24} height={6} rx={3} fill="var(--text-2)" opacity={0.4} />
          </g>
        )
      })}
    </Vignette>
  )
}

export function TablePreview(): JSX.Element {
  return (
    <Vignette label="Table">
      <rect x={12} y={14} width={30} height={5} rx={2.5} fill="var(--text-2)" opacity={0.75} />
      <rect x={84} y={14} width={20} height={5} rx={2.5} fill="var(--text-2)" opacity={0.75} />
      <rect x={116} y={14} width={20} height={5} rx={2.5} fill="var(--text-2)" opacity={0.75} />
      <line x1={12} x2={138} y1={25} y2={25} stroke="var(--chart-baseline)" strokeWidth={1} />
      {[0, 1, 2, 3].map((i) => {
        const y = 33 + i * 15
        return (
          <g key={i}>
            <rect x={12} y={y} width={i % 2 ? 38 : 46} height={5} rx={2.5} fill="var(--text-2)" opacity={0.5} />
            <rect x={86} y={y} width={18} height={5} rx={2.5} fill="var(--text-2)" opacity={0.6} />
            <rect x={118} y={y} width={18} height={5} rx={2.5} fill="var(--text-2)" opacity={0.6} />
          </g>
        )
      })}
    </Vignette>
  )
}

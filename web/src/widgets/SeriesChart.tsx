import type { JSX } from 'react'
import type { Point } from '../api/types'
import { Sparkline, TimeSeriesChart } from '../charts'

/**
 * Back-compat shim — the chart implementation moved to src/charts.
 * Old imports (`SeriesChart`, `ChartSeries`, `Sparkline`) keep working;
 * new code should import { TimeSeriesChart } from '../charts' directly.
 */

export { Sparkline }

export interface ChartSeries {
  label: string
  points: Point[]
  /** legacy — series color now comes from the fixed categorical slot */
  color?: string
}

export function SeriesChart({
  series,
  width,
  height,
  unit,
}: {
  series: ChartSeries[]
  width: number
  height: number
  unit?: string
}): JSX.Element {
  return (
    <TimeSeriesChart
      series={series.map((s, i) => ({ label: s.label, points: s.points, slot: i + 1 }))}
      width={width}
      height={height}
      unit={unit}
      kind="area"
    />
  )
}

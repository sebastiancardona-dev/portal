/**
 * Reusable SVG chart primitives — theme-aware via CSS custom properties,
 * sized by explicit width/height props, no chart library.
 *
 * All series colors come from the fixed categorical slots (--series-1..8);
 * status colors are reserved for state (HeatStrip, Gauge thresholds);
 * magnitude uses the sequential ramp (--seq-1..7). Text always wears ink.
 */

export { TimeSeriesChart, type SeriesDef } from './TimeSeriesChart'
export { Gauge } from './Gauge'
export { Donut } from './Donut'
export { HeatStrip } from './HeatStrip'
export { Sparkline } from './Sparkline'
export { monotonePath, niceScale, slotColor, seqColor } from './util'

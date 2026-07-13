import type { ComponentType, JSX } from 'react'
import type { SourceKind } from '../api/types'

/**
 * Widget SDK.
 *
 * A widget type is one module: define a component + a WidgetDef describing it,
 * register the def, done. The add-widget dialog renders the gallery card from
 * `category` + `Preview` and the config form generically from `configSchema`;
 * the grid enforces `defaultSize`/`minSize` — no dialog or grid changes needed
 * for a new widget type.
 */

export type ConfigFieldType = 'source' | 'select' | 'text' | 'range' | 'app'

export interface ConfigFieldOption {
  value: string
  label: string
}

/** Config values are strings — they round-trip the layout JSON untouched. */
export type WidgetConfig = Record<string, string>

export interface ConfigField {
  key: string
  label: string
  type: ConfigFieldType
  /** type 'select': the fixed choices */
  options?: ConfigFieldOption[]
  /** type 'source': restrict the source picker to one kind (omit = any source) */
  sourceKind?: SourceKind
  /** empty value allowed when false/omitted? default: optional */
  required?: boolean
  /** small helper text under the field */
  hint?: string
  /** hide the field (and skip its validation) unless this predicate passes */
  showIf?: (values: WidgetConfig) => boolean
}

export interface WidgetProps {
  config: WidgetConfig
  /** live content-box pixels (ResizeObserver) — charts size themselves off these */
  width: number
  height: number
}

export interface WidgetSize {
  w: number
  h: number
}

export type WidgetCategory = 'metrics' | 'health' | 'composition' | 'events'

export const WIDGET_CATEGORIES: { id: WidgetCategory; label: string }[] = [
  { id: 'metrics', label: 'Metrics' },
  { id: 'health', label: 'Health' },
  { id: 'composition', label: 'Composition' },
  { id: 'events', label: 'Events' },
]

export interface WidgetDef {
  /** stable identifier, persisted in the layout JSON */
  type: string
  label: string
  /** shown in the add-widget dialog */
  description: string
  /** gallery grouping in the add-widget dialog */
  category: WidgetCategory
  /** small static vignette (canned data, token colors, no fetching) for the gallery */
  Preview: () => JSX.Element
  configSchema: ConfigField[]
  /** grid units (12-column grid) */
  defaultSize: WidgetSize
  minSize: WidgetSize
  component: ComponentType<WidgetProps>
}

const registry = new Map<string, WidgetDef>()

export function registerWidget(def: WidgetDef): void {
  registry.set(def.type, def) // last write wins — keeps HMR re-registration harmless
}

export function getWidgetDef(type: string): WidgetDef | undefined {
  return registry.get(type)
}

export function listWidgetDefs(): WidgetDef[] {
  return [...registry.values()]
}

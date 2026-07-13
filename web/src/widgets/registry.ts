import type { ComponentType } from 'react'
import type { SourceKind } from '../api/types'

/**
 * Widget SDK.
 *
 * A widget type is one module: define a component + a WidgetDef describing it,
 * register the def, done. The add-widget dialog renders the config form
 * generically from `configSchema`, and the grid enforces `defaultSize`/`minSize`
 * — no dialog or grid changes needed for a new widget type.
 */

export type ConfigFieldType = 'source' | 'select' | 'text' | 'range'

export interface ConfigFieldOption {
  value: string
  label: string
}

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
}

/** Config values are strings — they round-trip the layout JSON untouched. */
export type WidgetConfig = Record<string, string>

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

export interface WidgetDef {
  /** stable identifier, persisted in the layout JSON */
  type: string
  label: string
  /** shown in the add-widget dialog */
  description: string
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

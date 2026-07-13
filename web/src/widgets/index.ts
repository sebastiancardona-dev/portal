import { registerWidget } from './registry'
import { statTileDef } from './StatTile'
import { lineChartDef } from './LineChartWidget'
import { statusListDef } from './StatusList'
import { tableDef } from './TableWidget'

/** The built-in widget set. A new widget type = one module + one line here. */
export function registerBuiltinWidgets(): void {
  registerWidget(statTileDef)
  registerWidget(lineChartDef)
  registerWidget(statusListDef)
  registerWidget(tableDef)
}

export * from './registry'

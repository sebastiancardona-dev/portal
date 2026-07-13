import './widgets.css'
import { registerWidget } from './registry'
import { statTileDef } from './StatTile'
import { lineChartDef } from './LineChartWidget'
import { barChartDef } from './BarChartWidget'
import { gaugeDef } from './GaugeWidget'
import { donutDef } from './DonutWidget'
import { uptimeHeatmapDef } from './UptimeHeatmapWidget'
import { deployFeedDef } from './DeployFeedWidget'
import { statusListDef } from './StatusList'
import { tableDef } from './TableWidget'

/** The built-in widget set. A new widget type = one module + one line here. */
export function registerBuiltinWidgets(): void {
  registerWidget(statTileDef)
  registerWidget(lineChartDef)
  registerWidget(barChartDef)
  registerWidget(gaugeDef)
  registerWidget(donutDef)
  registerWidget(uptimeHeatmapDef)
  registerWidget(deployFeedDef)
  registerWidget(statusListDef)
  registerWidget(tableDef)
}

export * from './registry'

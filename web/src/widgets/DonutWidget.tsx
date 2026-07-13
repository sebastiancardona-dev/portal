import { useMemo } from 'react'
import { useHost } from '../api/hooks'
import { Quiet, Skeleton } from '../ui'
import { Donut } from '../charts'
import { DonutPreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * How the host's resources split across containers. Containers are ordered
 * alphabetically before slot assignment so a container keeps its color
 * between polls (color follows the entity, not its rank).
 */

function DonutWidget({ config, width, height }: WidgetProps) {
  const dataset = config.dataset || 'container-memory'
  const host = useHost()

  const parts = useMemo(() => {
    const containers = [...(host.data?.containers ?? [])].sort((a, b) => a.name.localeCompare(b.name))
    return containers.map((c) => ({
      label: c.name,
      value: dataset === 'container-cpu' ? c.cpuPct : c.memBytes,
    }))
  }, [host.data, dataset])

  if (host.isPending) return <Skeleton height={Math.max(height - 20, 40)} />
  if (host.isError) return <Quiet>could not load host data</Quiet>
  if (parts.length === 0) return <Quiet>no containers reported yet</Quiet>

  const mem = dataset !== 'container-cpu'
  return (
    <Donut
      parts={parts}
      width={width}
      height={height}
      unit={mem ? 'bytes' : 'pct'}
      totalLabel={mem ? 'container mem' : 'container cpu'}
    />
  )
}

export const donutDef: WidgetDef = {
  type: 'donut',
  label: 'Donut',
  description: 'Composition ring — how memory or CPU splits across the containers on the host.',
  category: 'composition',
  Preview: DonutPreview,
  configSchema: [
    { key: 'label', label: 'Title', type: 'text', hint: 'shown in the widget header' },
    {
      key: 'dataset',
      label: 'Dataset',
      type: 'select',
      required: true,
      options: [
        { value: 'container-memory', label: 'Memory per container' },
        { value: 'container-cpu', label: 'CPU per container' },
      ],
    },
  ],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  component: DonutWidget,
}

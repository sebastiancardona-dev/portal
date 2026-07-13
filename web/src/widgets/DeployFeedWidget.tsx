import { ApiError } from '../api/client'
import { EnvBadge, Quiet, RelTime, Skeleton } from '../ui'
import { useDeploys } from './widgetHooks'
import { DeployFeedPreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * The ecosystem-wide deploy feed (GET /api/deploys, newest-first).
 * The endpoint may not be integrated yet — a 404 reads as the standard
 * quiet "no data yet", never an error wall.
 */

function DeployFeedWidget(_props: WidgetProps) {
  const deploys = useDeploys()

  if (deploys.isPending) {
    return (
      <div className="deploy-feed">
        <Skeleton height={22} />
        <Skeleton height={22} />
        <Skeleton height={22} />
      </div>
    )
  }
  if (deploys.isError) {
    return deploys.error instanceof ApiError && deploys.error.status === 404 ? (
      <Quiet>no deploy events yet</Quiet>
    ) : (
      <Quiet>could not load deploys</Quiet>
    )
  }
  if (deploys.data.length === 0) return <Quiet>no deploy events yet</Quiet>

  return (
    <div className="deploy-feed">
      {deploys.data.map((ev, i) => (
        <div key={`${ev.ts}:${ev.app}:${ev.env}:${i}`} className="deploy-feed-row">
          <span className="deploy-feed-app mono">{ev.app}</span>
          <EnvBadge env={ev.env} />
          <span className="deploy-feed-event">{ev.event}</span>
          <span className="deploy-feed-when mono">
            <RelTime ts={ev.ts} />
          </span>
        </div>
      ))}
    </div>
  )
}

export const deployFeedDef: WidgetDef = {
  type: 'deploy-feed',
  label: 'Deploy feed',
  description: 'Every deploy event across the ecosystem, newest first — what shipped, where, and when.',
  category: 'events',
  Preview: DeployFeedPreview,
  configSchema: [],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  component: DeployFeedWidget,
}

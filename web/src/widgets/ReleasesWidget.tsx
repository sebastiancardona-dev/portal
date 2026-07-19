import { EnvBadge, Quiet, RelTime, Skeleton } from '../ui'
import { useAppReleases, useReleasesFeed } from '../api/hooks'
import type { ReleaseInfo } from '../api/types'
import { ReleasesPreview } from './previews'
import type { WidgetDef, WidgetProps } from './registry'

/**
 * Recent releases (project 08): the GitHub release feed from the Postgres
 * cache, with deployed-env badges. Optionally pinned to one app.
 */

function Row({ release, showApp }: { release: ReleaseInfo; showApp: boolean }) {
  return (
    <div className="deploy-feed-row">
      {showApp && <span className="deploy-feed-app mono">{release.app}</span>}
      <span className="rel-widget-tag mono">{release.tag}</span>
      <span className="rel-widget-badges">
        {release.deployedProd && <EnvBadge env="prod" />}
        {release.deployedTest && <EnvBadge env="test" />}
      </span>
      <span className="deploy-feed-when mono">
        <RelTime ts={release.publishedAt} />
      </span>
    </div>
  )
}

function ReleasesWidget({ config }: WidgetProps) {
  const app = config.app ?? ''
  const feed = useReleasesFeed(12)
  const appReleases = useAppReleases(app || undefined)
  const query = app ? appReleases : feed

  if (query.isPending) {
    return (
      <div className="deploy-feed">
        <Skeleton height={22} />
        <Skeleton height={22} />
        <Skeleton height={22} />
      </div>
    )
  }
  if (query.isError) return <Quiet>could not load releases</Quiet>
  if (!query.data.available) return <Quiet>releases module not connected</Quiet>
  const releases = query.data.releases.slice(0, 12)
  if (releases.length === 0) return <Quiet>no releases synced yet</Quiet>

  return (
    <div className="deploy-feed">
      {releases.map((release) => (
        <Row key={`${release.repo}:${release.tag}`} release={release} showApp={!app} />
      ))}
    </div>
  )
}

export const releasesDef: WidgetDef = {
  type: 'recent-releases',
  label: 'Recent releases',
  description: 'What shipped lately across the ecosystem — GitHub releases with deployed-env markers.',
  category: 'events',
  Preview: ReleasesPreview,
  configSchema: [
    { key: 'label', label: 'Title', type: 'text', hint: 'shown in the widget header' },
    { key: 'app', label: 'App', type: 'app', hint: 'leave empty for the whole ecosystem' },
  ],
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  component: ReleasesWidget,
}

import { useState } from 'react'
import { Check, Copy, ExternalLink, GitCompareArrows, PackageOpen } from 'lucide-react'
import { useAppReleases, useApps, useReleasesFeed } from '../api/hooks'
import type { ReleaseInfo } from '../api/types'
import { EmptyState, EnvBadge, Quiet, RelTime, Skeleton, StatusDot } from '../ui'

/** [{name,size,downloadUrl}] parsed from the cached JSON; [] when none/garbage. */
function parseAssets(json: string | null): { name: string; size: number; downloadUrl: string }[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function fmtBytes(size: number): string {
  if (size >= 1_048_576) return `${(size / 1_048_576).toFixed(1)} MiB`
  if (size >= 1024) return `${(size / 1024).toFixed(0)} KiB`
  return `${size} B`
}

/** Copyable command chip — the standard copy feedback (icon flips to a check). */
function CopyCmd({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rel-cmd">
      <code className="mono">{text}</code>
      <button
        type="button"
        className={`btn btn-ghost btn-sm btn-icon${copied ? ' copied' : ''}`}
        aria-label={label}
        title={label}
        onClick={() =>
          navigator.clipboard?.writeText(text).then(
            () => {
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            },
            () => undefined,
          )
        }
      >
        {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.75} />}
      </button>
    </div>
  )
}

/** The artifact panel: every way to get your hands on exactly this version. */
function ArtifactPanel({ release }: { release: ReleaseInfo }) {
  const assets = parseAssets(release.assets)
  return (
    <div className="rel-artifacts">
      {release.name && release.name !== release.tag && (
        <span className="rel-release-name">{release.name}</span>
      )}
      <CopyCmd text={`docker pull ${release.imageRef}`} label="Copy the image pull command" />
      <div className="rel-links">
        {release.htmlUrl && (
          <a href={release.htmlUrl} target="_blank" rel="noreferrer" className="rel-link">
            <ExternalLink size={13} strokeWidth={1.75} aria-hidden="true" />
            release on GitHub
          </a>
        )}
        {release.compareUrl && (
          <a href={release.compareUrl} target="_blank" rel="noreferrer" className="rel-link">
            <GitCompareArrows size={13} strokeWidth={1.75} aria-hidden="true" />
            diff vs previous
          </a>
        )}
      </div>
      {assets.length > 0 && (
        <ul className="rel-assets">
          {assets.map((asset) => (
            <li key={asset.name}>
              <a href={asset.downloadUrl} target="_blank" rel="noreferrer" className="rel-link mono">
                {asset.name}
              </a>
              <span className="muted"> · {fmtBytes(asset.size)}</span>
            </li>
          ))}
        </ul>
      )}
      {release.body && <pre className="rel-notes">{release.body}</pre>}
    </div>
  )
}

function ReleaseRow({ release, showApp }: { release: ReleaseInfo; showApp: boolean }) {
  const [open, setOpen] = useState(false)
  const columns = showApp ? 4 : 3
  return (
    <>
      <tr
        className="log-row"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? 'Collapse' : 'Show artifacts and notes'}
      >
        {showApp && <td className="mono rel-app">{release.app}</td>}
        <td className="mono rel-tag">
          {release.tag}
          {release.prerelease && <span className="soon-tag">pre</span>}
        </td>
        <td className="rel-deployed">
          {release.deployedProd && <EnvBadge env="prod" />}
          {release.deployedTest && <EnvBadge env="test" />}
        </td>
        <td className="rel-when mono">
          <RelTime ts={release.publishedAt} />
        </td>
      </tr>
      {open && (
        <tr className="log-detail">
          <td colSpan={columns}>
            <ArtifactPanel release={release} />
          </td>
        </tr>
      )}
    </>
  )
}

function ReleasesTable({ releases, showApp }: { releases: ReleaseInfo[]; showApp: boolean }) {
  return (
    <div className="table-scroll">
      <table className="data-table logs-table">
        <thead>
          <tr>
            {showApp && <th>App</th>}
            <th>Version</th>
            <th>Deployed</th>
            <th>Published</th>
          </tr>
        </thead>
        <tbody>
          {releases.map((release) => (
            <ReleaseRow key={`${release.repo}:${release.tag}`} release={release} showApp={showApp} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Drift, in words — the color never carries the meaning alone. */
function DriftLine({ prodBehind, prodVersion }: { prodBehind: number | null; prodVersion: string | null }) {
  if (prodVersion == null) return <StatusDot state="off" label="nothing on prod yet" />
  if (prodBehind == null) return <StatusDot state="off" label={`prod runs ${prodVersion} — not a known release`} />
  if (prodBehind === 0) return <StatusDot state="ok" label="prod is on the latest release" />
  return (
    <StatusDot
      state="warn"
      label={`prod is ${prodBehind} release${prodBehind === 1 ? '' : 's'} behind`}
    />
  )
}

function AppTimeline({ app }: { app: string }) {
  const releases = useAppReleases(app)
  if (releases.isPending) return <Skeleton height={280} />
  if (releases.isError) return <Quiet>could not load releases — {releases.error.message}</Quiet>
  const data = releases.data
  return (
    <>
      <div className="rel-summary">
        <DriftLine prodBehind={data.prodBehind} prodVersion={data.prodVersion} />
        <span className="rel-summary-envs mono">
          {data.prodVersion && (
            <span>
              <EnvBadge env="prod" /> {data.prodVersion}
            </span>
          )}
          {data.testVersion && (
            <span>
              <EnvBadge env="test" /> {data.testVersion}
            </span>
          )}
        </span>
      </div>
      {data.releases.length === 0 ? (
        <Quiet>no releases synced for {app} yet</Quiet>
      ) : (
        <ReleasesTable releases={data.releases} showApp={false} />
      )}
    </>
  )
}

export function ReleasesPage() {
  const feed = useReleasesFeed(50)
  const apps = useApps()
  const [selected, setSelected] = useState('')

  if (feed.isPending) {
    return (
      <div className="page-skeleton">
        <Skeleton height={60} />
        <Skeleton height={300} />
      </div>
    )
  }
  if (feed.isError) {
    return <Quiet>could not load the releases module — {feed.error.message}</Quiet>
  }
  if (!feed.data.available) {
    return (
      <>
        <ReleasesHead lastSyncAt={null} />
        <EmptyState icon={<PackageOpen size={20} strokeWidth={1.5} />}>
          the releases module is not connected in this environment — set PORTAL_GITHUB_TOKEN
          (fine-grained read-only PAT) in the portal stack env and it syncs within minutes
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <ReleasesHead lastSyncAt={feed.data.lastSyncAt} />
      <section className="panel">
        <div className="logs-toolbar">
          <label>
            <span>App</span>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">all — recent releases</option>
              {apps.data?.map((app) => (
                <option key={app.app} value={app.app}>
                  {app.displayName || app.app}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selected ? (
          <AppTimeline app={selected} />
        ) : feed.data.releases.length === 0 ? (
          <Quiet>nothing synced yet — the first sync lands within minutes</Quiet>
        ) : (
          <ReleasesTable releases={feed.data.releases} showApp={true} />
        )}
      </section>
    </>
  )
}

function ReleasesHead({ lastSyncAt }: { lastSyncAt: string | null }) {
  return (
    <header className="page-head">
      <div className="page-id">
        <span className="eyebrow">Modules</span>
        <h1 className="page-title">Releases</h1>
      </div>
      <div className="page-meta mono">
        GitHub · cached in Postgres{lastSyncAt && (
          <>
            {' '}· synced <RelTime ts={lastSyncAt} />
          </>
        )}
      </div>
    </header>
  )
}

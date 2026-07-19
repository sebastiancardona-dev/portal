import { useState } from 'react'
import { useApps, useDeleteOverride, useRegistryOverrides, useSaveOverride } from '../api/hooks'
import type { RegistryOverride } from '../api/types'
import { Quiet, Skeleton } from '../ui'

interface Row {
  app: string
  /** what discovery would call it, before any override */
  discoveredName: string
  override: RegistryOverride | null
}

function RegistryRow({ row }: { row: Row }) {
  const save = useSaveOverride()
  const del = useDeleteOverride()
  const [displayName, setDisplayName] = useState(row.override?.displayName ?? '')
  const [icon, setIcon] = useState(row.override?.icon ?? '')
  const [visible, setVisible] = useState(row.override?.visible ?? true)
  const [healthPath, setHealthPath] = useState(row.override?.healthPath ?? '')
  const [baseHost, setBaseHost] = useState(row.override?.baseHost ?? '')
  const [repo, setRepo] = useState(row.override?.repo ?? '')

  const dirty =
    displayName !== (row.override?.displayName ?? '') ||
    icon !== (row.override?.icon ?? '') ||
    visible !== (row.override?.visible ?? true) ||
    healthPath !== (row.override?.healthPath ?? '') ||
    baseHost !== (row.override?.baseHost ?? '') ||
    repo !== (row.override?.repo ?? '')

  return (
    <tr>
      <td className="mono">{row.app}</td>
      <td>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={row.discoveredName}
          aria-label={`Display name for ${row.app}`}
        />
      </td>
      <td className="settings-icon-cell">
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="auto"
          maxLength={8}
          aria-label={`Icon for ${row.app}`}
        />
      </td>
      <td className="settings-visible-cell">
        <label className="visible-toggle">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            aria-label={`Show ${row.app} in the portal`}
          />
          <span>{visible ? 'shown' : 'hidden'}</span>
        </label>
      </td>
      <td>
        <input
          type="text"
          className="mono"
          value={healthPath}
          onChange={(e) => setHealthPath(e.target.value)}
          placeholder="/health"
          aria-label={`Health path for ${row.app}`}
        />
      </td>
      <td>
        <input
          type="text"
          className="mono"
          value={baseHost}
          onChange={(e) => setBaseHost(e.target.value)}
          placeholder="auto (docker)"
          title="Bare host, e.g. tools.example.dev — builds env URLs when Docker discovery is absent (test = first label + -test)"
          aria-label={`Base host for ${row.app}`}
        />
      </td>
      <td>
        <input
          type="text"
          className="mono"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder={row.app}
          title={'GitHub repo name when it differs from the app name (releases module); "-" = no repo, skip the release sync'}
          aria-label={`GitHub repo for ${row.app}`}
        />
      </td>
      <td className="settings-actions">
        <button
          type="button"
          // secondary until there is actually something to save
          className={dirty ? 'btn btn-primary' : 'btn'}
          disabled={!dirty || save.isPending}
          onClick={() =>
            save.mutate({ app: row.app, displayName, icon, visible, healthPath, baseHost, repo })
          }
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {row.override && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={del.isPending}
            title="Remove the override — the app falls back to its discovered defaults"
            onClick={() => del.mutate(row.app)}
          >
            Reset
          </button>
        )}
      </td>
    </tr>
  )
}

export function SettingsPage() {
  const apps = useApps()
  const overrides = useRegistryOverrides()

  if (apps.isPending || overrides.isPending) {
    return (
      <div className="page-skeleton">
        <Skeleton height={60} />
        <Skeleton height={200} />
      </div>
    )
  }
  if (overrides.isError) return <Quiet>could not load the registry — admin access is required</Quiet>

  const byApp = new Map((overrides.data ?? []).map((o) => [o.app, o]))
  const rows: Row[] = (apps.data ?? []).map((a) => ({
    app: a.app,
    discoveredName: a.displayName || a.app,
    override: byApp.get(a.app) ?? null,
  }))
  // overrides for apps that discovery no longer lists (or that are hidden)
  for (const o of overrides.data ?? []) {
    if (!rows.some((r) => r.app === o.app)) {
      rows.push({ app: o.app, discoveredName: o.app, override: o })
    }
  }
  rows.sort((a, b) => a.app.localeCompare(b.app))

  return (
    <>
      <header className="page-head">
        <div className="page-id">
          <span className="eyebrow">Configure</span>
          <h1 className="page-title">Settings</h1>
        </div>
      </header>

      <section className="panel">
        <h2 className="panel-title">App registry</h2>
        <p className="settings-microcopy">
          Overrides only — apps are discovered automatically and can never be added by hand.
          Blank fields fall back to the discovered values.
        </p>
        {rows.length === 0 ? (
          <Quiet>no apps discovered yet — there is nothing to override</Quiet>
        ) : (
          <div className="table-scroll">
            <table className="data-table settings-table">
              <thead>
                <tr>
                  <th>App</th>
                  <th>Display name</th>
                  <th>Icon</th>
                  <th>Visible</th>
                  <th>Health path</th>
                  <th>Base host</th>
                  <th>GitHub repo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <RegistryRow key={`${row.app}-${JSON.stringify(row.override)}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

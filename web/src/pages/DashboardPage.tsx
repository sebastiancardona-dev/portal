import { useEffect, useRef, useState } from 'react'
import { useApps, useDashboardLayout, useSaveLayout } from '../api/hooks'
import { AddWidgetDialog } from '../grid/AddWidgetDialog'
import { DashboardGrid, type DashboardGridHandle } from '../grid/DashboardGrid'
import { useDashboardChrome } from '../shell/DashboardChrome'
import { Quiet, RelTime, Skeleton } from '../ui'
import type { WidgetConfig } from '../widgets/registry'

export function DashboardPage() {
  const layout = useDashboardLayout()
  const apps = useApps() // its 30s poll doubles as the page's refresh heartbeat
  const save = useSaveLayout()
  const chrome = useDashboardChrome()
  const grid = useRef<DashboardGridHandle>(null)
  const [adding, setAdding] = useState(false)

  const { setOnDashboard, setEditing, setDirty, setSaving } = chrome
  useEffect(() => {
    setOnDashboard(true)
    return () => {
      setOnDashboard(false)
      setEditing(false)
      setDirty(false)
    }
  }, [setOnDashboard, setEditing, setDirty])

  // topbar flipped "Done editing" → persist the layout
  const wasEditing = useRef(chrome.editing)
  useEffect(() => {
    if (wasEditing.current && !chrome.editing && grid.current) {
      setSaving(true)
      save.mutate(grid.current.getLayout(), {
        onSuccess: () => setDirty(false),
        onSettled: () => setSaving(false),
      })
    }
    wasEditing.current = chrome.editing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chrome.editing])

  function addWidget(type: string, config: WidgetConfig) {
    grid.current?.addWidget(type, config)
    setDirty(true)
  }

  if (layout.isPending) {
    return (
      <div className="page-skeleton">
        <Skeleton height={168} />
        <Skeleton height={168} />
        <Skeleton height={168} />
      </div>
    )
  }
  if (layout.isError) return <Quiet>could not load your dashboard layout</Quiet>

  const refreshedAt = apps.dataUpdatedAt > 0 ? new Date(apps.dataUpdatedAt).toISOString() : null

  return (
    <>
      <header className="page-head">
        <div className="page-id">
          <span className="eyebrow">Overview</span>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <span className="page-meta">
          refreshed <RelTime ts={refreshedAt} />
        </span>
      </header>
      {chrome.editing && (
        <div className="dash-toolbar">
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            + Add widget
          </button>
          <span className="dash-hint">drag by the handle · resize from the corner</span>
        </div>
      )}
      <DashboardGrid
        ref={grid}
        initial={layout.data.widgets}
        editing={chrome.editing}
        onDirty={() => setDirty(true)}
      />
      {adding && <AddWidgetDialog onAdd={addWidget} onClose={() => setAdding(false)} />}
    </>
  )
}

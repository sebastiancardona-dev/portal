import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Shared state between the topbar (edit-layout toggle + saved/unsaved
 * indicator) and the dashboard page (which owns the grid and does the saving).
 */
interface DashboardChrome {
  onDashboard: boolean
  editing: boolean
  dirty: boolean
  saving: boolean
  setOnDashboard: (v: boolean) => void
  setEditing: (v: boolean) => void
  setDirty: (v: boolean) => void
  setSaving: (v: boolean) => void
}

const Ctx = createContext<DashboardChrome>({
  onDashboard: false,
  editing: false,
  dirty: false,
  saving: false,
  setOnDashboard: () => {},
  setEditing: () => {},
  setDirty: () => {},
  setSaving: () => {},
})

export function DashboardChromeProvider({ children }: { children: ReactNode }) {
  const [onDashboard, setOnDashboard] = useState(false)
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const value = useMemo(
    () => ({ onDashboard, editing, dirty, saving, setOnDashboard, setEditing, setDirty, setSaving }),
    [onDashboard, editing, dirty, saving],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDashboardChrome() {
  return useContext(Ctx)
}

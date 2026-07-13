import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApps, useSources } from '../api/hooks'
import { appLedState, Led, type LedState } from '../ui'

interface PaletteItem {
  key: string
  group: 'pages' | 'apps' | 'sources'
  label: string
  /** mono detail on the right (version, source id, route) */
  hint?: string
  led?: LedState
  to: string
}

const GROUP_TITLES: Record<PaletteItem['group'], string> = {
  pages: 'Pages',
  apps: 'Apps',
  sources: 'Data sources',
}

const PAGES: PaletteItem[] = [
  { key: 'page-dashboard', group: 'pages', label: 'Dashboard', hint: '/', to: '/' },
  { key: 'page-apps', group: 'pages', label: 'Apps', hint: '/apps', to: '/apps' },
  { key: 'page-host', group: 'pages', label: 'Host', hint: '/host', to: '/host' },
  { key: 'page-settings', group: 'pages', label: 'Settings', hint: '/settings', to: '/settings' },
]

function matches(item: PaletteItem, q: string): boolean {
  return (
    item.label.toLowerCase().includes(q) || (item.hint ?? '').toLowerCase().includes(q)
  )
}

/**
 * Ctrl+K / ⌘K command palette: pages, every discovered app, and data sources.
 * Sources only surface once the operator starts typing — the empty state stays
 * scannable (pages + apps), the full source list is one keystroke away.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const apps = useApps()
  const sources = useSources()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase()
    const appItems: PaletteItem[] =
      apps.data?.map((app) => {
        const prod = app.environments.find((e) => e.env === 'prod') ?? app.environments[0]
        return {
          key: `app-${app.app}`,
          group: 'apps' as const,
          label: app.displayName || app.app,
          hint: prod?.version || app.app,
          led: appLedState(app.environments),
          to: `/apps/${app.app}`,
        }
      }) ?? []
    const sourceItems: PaletteItem[] =
      sources.data?.map((s) => ({
        key: `source-${s.id}`,
        group: 'sources' as const,
        label: s.label,
        hint: s.id,
        to: s.app ? `/apps/${s.app}` : '/host',
      })) ?? []
    const all = q === '' ? [...PAGES, ...appItems] : [...PAGES, ...appItems, ...sourceItems]
    return q === '' ? all : all.filter((item) => matches(item, q))
  }, [query, apps.data, sources.data])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // the filtered list changed under the cursor — snap back to the top match
  useEffect(() => setActive(0), [query])

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, items])

  function go(item: PaletteItem) {
    onClose()
    navigate(item.to)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[active]) go(items[active])
    }
  }

  let lastGroup: PaletteItem['group'] | null = null

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search the portal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to a page, app, or data source…"
          aria-label="Search the portal"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={items[active]?.key}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {items.length === 0 && (
            <div className="palette-empty">nothing matches “{query}”</div>
          )}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? GROUP_TITLES[item.group] : null
            lastGroup = item.group
            return (
              <div key={item.key}>
                {header && <div className="palette-eyebrow">{header}</div>}
                <button
                  type="button"
                  id={item.key}
                  className={`palette-row${i === active ? ' active' : ''}`}
                  data-active={i === active || undefined}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(item)}
                >
                  {item.led != null ? (
                    <Led state={item.led} />
                  ) : (
                    <span className="palette-bullet" aria-hidden="true" />
                  )}
                  <span className="palette-label">{item.label}</span>
                  {item.hint && <span className="palette-hint">{item.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="palette-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}

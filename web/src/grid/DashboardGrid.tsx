import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { GridStack, type GridItemHTMLElement } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'
import type { DashboardLayout, LayoutWidget } from '../api/types'
import { getWidgetDef, type WidgetConfig } from '../widgets/registry'
import { WidgetFrame } from '../widgets/WidgetFrame'

/**
 * React 19 ref-wrapper around gridstack (framework-agnostic — no React peer
 * range to fight). Ownership split: React owns widget identity + config and
 * renders each item's DOM; gridstack owns geometry (drag, resize, float,
 * column packing). Positions are read back off the engine only when saving.
 */

export interface DashboardGridHandle {
  addWidget(type: string, config: WidgetConfig): void
  getLayout(): DashboardLayout
}

interface Item extends LayoutWidget {
  /** freshly added — let gridstack pick the first free slot */
  autoPos?: boolean
}

export function DashboardGrid({
  initial,
  editing,
  onDirty,
  ref,
}: {
  initial: LayoutWidget[]
  editing: boolean
  onDirty: () => void
  ref?: Ref<DashboardGridHandle>
}) {
  const [items, setItems] = useState<Item[]>(initial)
  const gridRef = useRef<GridStack | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const itemEls = useRef(new Map<string, GridItemHTMLElement>())
  const editingRef = useRef(editing)
  editingRef.current = editing
  const onDirtyRef = useRef(onDirty)
  onDirtyRef.current = onDirty

  useLayoutEffect(() => {
    const grid = GridStack.init(
      {
        auto: false, // the reconcile effect below registers items with their real geometry
        column: 12,
        cellHeight: 88,
        margin: 8,
        float: true,
        staticGrid: !editingRef.current,
        handle: '.widget-drag',
        animate: true,
        columnOpts: { breakpointForWindow: true, breakpoints: [{ w: 640, c: 1 }] },
      },
      rootRef.current!,
    )
    gridRef.current = grid
    // geometry changed under drag/resize (or a new widget landed) — mark dirty
    grid.on('change', () => {
      if (editingRef.current) onDirtyRef.current()
    })
    return () => {
      grid.destroy(false) // React owns the DOM; this also clears el.gridstackNode
      gridRef.current = null
    }
  }, [])

  useEffect(() => {
    gridRef.current?.setStatic(!editing)
  }, [editing])

  // reconcile gridstack's node list with React's item list (add/remove only —
  // pure geometry changes never re-render React)
  const idsKey = items.map((it) => it.id).join('|')
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    grid.batchUpdate()
    for (const node of [...grid.engine.nodes]) {
      if (node.el && !items.some((it) => it.id === node.id)) {
        grid.removeWidget(node.el, false, false)
      }
    }
    for (const it of items) {
      const el = itemEls.current.get(it.id)
      if (el && !el.gridstackNode) {
        const def = getWidgetDef(it.type)
        grid.makeWidget(el, {
          id: it.id,
          x: it.x,
          y: it.y,
          w: it.w,
          h: it.h,
          minW: def?.minSize.w,
          minH: def?.minSize.h,
          autoPosition: it.autoPos || undefined,
        })
      }
    }
    grid.batchUpdate(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
    onDirtyRef.current()
  }

  useImperativeHandle(ref, () => ({
    addWidget(type: string, config: WidgetConfig) {
      const def = getWidgetDef(type)
      const size = def?.defaultSize ?? { w: 3, h: 2 }
      setItems((prev) => [
        ...prev,
        { id: crypto.randomUUID(), type, x: 0, y: 0, w: size.w, h: size.h, config, autoPos: true },
      ])
    },
    getLayout(): DashboardLayout {
      const nodes = gridRef.current?.engine.nodes ?? []
      return {
        widgets: items.map((it) => {
          const node = nodes.find((n) => n.id === it.id)
          return {
            id: it.id,
            type: it.type,
            x: node?.x ?? it.x,
            y: node?.y ?? it.y,
            w: node?.w ?? it.w,
            h: node?.h ?? it.h,
            config: it.config,
          }
        }),
      }
    },
  }))

  return (
    <div className="grid-stack" ref={rootRef}>
      {items.map((it) => (
        <div
          key={it.id}
          className="grid-stack-item"
          ref={(el) => {
            if (el) itemEls.current.set(it.id, el as GridItemHTMLElement)
            else itemEls.current.delete(it.id)
          }}
        >
          <div className="grid-stack-item-content">
            <WidgetFrame
              type={it.type}
              config={it.config}
              editing={editing}
              onRemove={() => removeItem(it.id)}
            />
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="grid-empty">
          {editing ? 'Add your first widget with the button above.' : 'This dashboard is empty — switch to edit mode to add widgets.'}
        </div>
      )}
    </div>
  )
}

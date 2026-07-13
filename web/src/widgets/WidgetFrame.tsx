import { useLayoutEffect, useRef, useState } from 'react'
import { ErrorBoundary, Quiet } from '../ui'
import { getWidgetDef, type WidgetConfig } from './registry'

/**
 * Chrome around a widget instance: measures the content box (widgets get live
 * pixel width/height), shows the edit-mode bar (drag handle + remove), and
 * fences crashes so one bad widget never takes the dashboard down.
 */
export function WidgetFrame({
  type,
  config,
  editing,
  onRemove,
}: {
  type: string
  config: WidgetConfig
  editing?: boolean
  onRemove?: () => void
}) {
  const def = getWidgetDef(type)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={`widget-card${editing ? ' editing' : ''}`}>
      {editing && (
        <div className="widget-edit-bar">
          <span className="widget-drag" title="Drag to move">
            <span aria-hidden="true">⠿</span> {def?.label ?? type}
          </span>
          <button type="button" className="widget-remove" onClick={onRemove} aria-label="Remove widget">
            ✕
          </button>
        </div>
      )}
      <div className="widget-body" ref={bodyRef}>
        <ErrorBoundary>
          {def == null ? (
            <Quiet>unknown widget type “{type}”</Quiet>
          ) : (
            size.width > 0 && <def.component config={config} width={size.width} height={size.height} />
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}

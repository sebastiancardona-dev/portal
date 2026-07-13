import { useLayoutEffect, useRef, useState } from 'react'
import { GripVertical, X } from 'lucide-react'
import { ErrorBoundary, Quiet } from '../ui'
import { getWidgetDef, type WidgetConfig } from './registry'

/**
 * Chrome around a widget instance: an eyebrow title bar (mono uppercase,
 * instrument-panel style) that doubles as the drag handle in edit mode,
 * content-box measurement (widgets get live pixel width/height), and an
 * error fence so one bad widget never takes the dashboard down.
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

  // the eyebrow prefers the user's own title; the widget type is the fallback.
  // Widgets that print a subject internally suppress it when config.label is
  // set, so a label never reads twice.
  const title = (typeof config.label === 'string' && config.label) || def?.label || type

  return (
    <div className={`widget-card${editing ? ' editing' : ''}`}>
      <div className={`widget-head${editing ? ' editing' : ''}`}>
        {editing ? (
          <span className="widget-drag" title="Drag to move">
            <span className="widget-grip" aria-hidden="true">
              <GripVertical size={14} strokeWidth={1.75} />
            </span>
            <span className="widget-eyebrow">{title}</span>
          </span>
        ) : (
          <span className="widget-eyebrow">{title}</span>
        )}
        {editing && (
          <button type="button" className="widget-remove" onClick={onRemove} aria-label="Remove widget">
            <X size={14} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
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

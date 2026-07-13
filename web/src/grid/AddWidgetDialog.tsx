import { useEffect, useState } from 'react'
import { useSources } from '../api/hooks'
import { SERIES_RANGES } from '../api/types'
import {
  listWidgetDefs,
  type ConfigField,
  type WidgetConfig,
  type WidgetDef,
} from '../widgets/registry'

/**
 * Two steps: pick a widget type (straight from the registry), then fill a
 * config form rendered generically from the type's configSchema. New widget
 * types show up here with zero dialog changes.
 */
export function AddWidgetDialog({
  onAdd,
  onClose,
}: {
  onAdd: (type: string, config: WidgetConfig) => void
  onClose: () => void
}) {
  const [def, setDef] = useState<WidgetDef | null>(null)
  const [values, setValues] = useState<WidgetConfig>({})
  const sources = useSources()

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function pick(d: WidgetDef) {
    const seed: WidgetConfig = {}
    for (const field of d.configSchema) {
      if (field.type === 'range') seed[field.key] = '6h'
      else if (field.type === 'select' && field.required && field.options?.length) {
        seed[field.key] = field.options[0].value
      }
    }
    setValues(seed)
    setDef(d)
  }

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  const valid = def != null && def.configSchema.every((f) => !f.required || !!values[f.key])

  function submit() {
    if (!def || !valid) return
    // drop empty optional values so the persisted config stays tidy
    const config = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''))
    onAdd(def.type, config)
    onClose()
  }

  function renderField(field: ConfigField) {
    const value = values[field.key] ?? ''
    switch (field.type) {
      case 'source': {
        const pool = (sources.data ?? []).filter(
          (s) => !field.sourceKind || s.kind === field.sourceKind,
        )
        return (
          <select value={value} onChange={(e) => set(field.key, e.target.value)}>
            <option value="">{field.required ? 'Pick a source…' : '— none —'}</option>
            {pool.map((s) => (
              <option key={s.id} value={s.id} title={s.id}>
                {s.label || s.id}
              </option>
            ))}
          </select>
        )
      }
      case 'select':
        return (
          <select value={value} onChange={(e) => set(field.key, e.target.value)}>
            {!field.required && <option value="">— default —</option>}
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )
      case 'range':
        return (
          <select value={value} onChange={(e) => set(field.key, e.target.value)}>
            {SERIES_RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )
      case 'text':
        return <input type="text" value={value} onChange={(e) => set(field.key, e.target.value)} />
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add widget"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h2>{def ? `Add ${def.label.toLowerCase()}` : 'Add widget'}</h2>
          <button type="button" className="widget-remove" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {def == null ? (
          <div className="widget-type-list">
            {listWidgetDefs().map((d) => (
              <button key={d.type} type="button" className="widget-type" onClick={() => pick(d)}>
                <span className="widget-type-label">{d.label}</span>
                <span className="widget-type-desc">{d.description}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <form
              className="dialog-form"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              {def.configSchema.length === 0 && (
                <p className="quiet">Nothing to configure — this widget is ready to go.</p>
              )}
              {def.configSchema.map((field) => (
                <label key={field.key}>
                  {field.label}
                  {renderField(field)}
                  {field.hint && <span className="field-hint">{field.hint}</span>}
                </label>
              ))}
            </form>
            {sources.isPending && def.configSchema.some((f) => f.type === 'source') && (
              <p className="quiet">loading sources…</p>
            )}
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setDef(null)}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={!valid} onClick={submit}>
                Add widget
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

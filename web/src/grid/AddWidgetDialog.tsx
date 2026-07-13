import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useApps, useSources } from '../api/hooks'
import { SERIES_RANGES } from '../api/types'
import { WidgetFrame } from '../widgets/WidgetFrame'
import {
  WIDGET_CATEGORIES,
  listWidgetDefs,
  type ConfigField,
  type WidgetConfig,
  type WidgetDef,
} from '../widgets/registry'

/**
 * Two steps. "Gallery": every widget type as a visual card (its Preview
 * vignette), grouped by category, keyboard navigable. "Configure": a form
 * generated from the type's configSchema on the left, and a LIVE preview —
 * the real widget component against real data — on the right. New widget
 * types show up here with zero dialog changes.
 */

type Step = 'gallery' | 'configure'

function visibleFields(def: WidgetDef, values: WidgetConfig): ConfigField[] {
  return def.configSchema.filter((f) => !f.showIf || f.showIf(values))
}

export function AddWidgetDialog({
  onAdd,
  onClose,
}: {
  onAdd: (type: string, config: WidgetConfig) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>('gallery')
  const [selected, setSelected] = useState<WidgetDef | null>(null)
  const [values, setValues] = useState<WidgetConfig>({})
  const sources = useSources()
  const apps = useApps()
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const defs = listWidgetDefs()
  const groups = WIDGET_CATEGORIES.map((cat) => ({
    ...cat,
    defs: defs.filter((d) => d.category === cat.id),
  })).filter((g) => g.defs.length > 0)
  const flat = groups.flatMap((g) => g.defs)

  /** Prefill every field with a sensible default so the preview lights up immediately. */
  function seedFor(def: WidgetDef): WidgetConfig {
    const seed: WidgetConfig = {}
    for (const field of def.configSchema) {
      if (field.type === 'range') seed[field.key] = '6h'
      else if (field.type === 'select' && field.options?.length) seed[field.key] = field.options[0].value
      else if (field.type === 'source' && field.required) {
        const pool = (sources.data ?? []).filter((s) => !field.sourceKind || s.kind === field.sourceKind)
        if (pool.length > 0) seed[field.key] = pool[0].id
      } else if (field.type === 'app' && field.required && apps.data?.length) {
        seed[field.key] = apps.data[0].app
      }
    }
    return seed
  }

  function goConfigure(def: WidgetDef) {
    setValues(seedFor(def))
    setSelected(def)
    setStep('configure')
  }

  function pick(def: WidgetDef) {
    if (selected?.type === def.type) goConfigure(def)
    else setSelected(def)
  }

  function onGalleryKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const idx = selected ? flat.findIndex((d) => d.type === selected.type) : -1
    let next: number
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = flat.length - 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = idx <= 0 ? flat.length - 1 : idx - 1
    else next = idx >= flat.length - 1 ? 0 : idx + 1
    const def = flat[next]
    setSelected(def)
    cardRefs.current.get(def.type)?.focus()
  }

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  const fields = selected && step === 'configure' ? visibleFields(selected, values) : []
  const valid = selected != null && fields.every((f) => !f.required || !!values[f.key])
  const previewConfig = useMemo(
    () => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')),
    [values],
  )

  function submit() {
    if (!selected || !valid) return
    // drop empty (and hidden) values so the persisted config stays tidy
    const visible = new Set(fields.map((f) => f.key))
    const config = Object.fromEntries(
      Object.entries(values).filter(([k, v]) => v !== '' && visible.has(k)),
    )
    onAdd(selected.type, config)
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
      case 'app':
        return (
          <select value={value} onChange={(e) => set(field.key, e.target.value)}>
            <option value="">{field.required ? 'Pick an app…' : '— none —'}</option>
            {(apps.data ?? []).map((a) => (
              <option key={a.app} value={a.app}>
                {a.displayName || a.app}
              </option>
            ))}
          </select>
        )
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
        className="dialog awd-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add widget"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <h2>{step === 'configure' && selected ? `Configure ${selected.label.toLowerCase()}` : 'Add widget'}</h2>
          <button type="button" className="widget-remove" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {step === 'gallery' ? (
          <>
            <div role="listbox" aria-label="Widget types" tabIndex={-1} onKeyDown={onGalleryKeyDown}>
              {groups.map((g) => (
                <div key={g.id} className="awd-category">
                  <span className="awd-category-label">{g.label}</span>
                  <div className="awd-gallery">
                    {g.defs.map((d) => (
                      <button
                        key={d.type}
                        ref={(el) => {
                          if (el) cardRefs.current.set(d.type, el)
                          else cardRefs.current.delete(d.type)
                        }}
                        type="button"
                        role="option"
                        aria-selected={selected?.type === d.type}
                        className={`awd-card${selected?.type === d.type ? ' selected' : ''}`}
                        onClick={() => pick(d)}
                        onDoubleClick={() => goConfigure(d)}
                      >
                        <d.Preview />
                        <span className="awd-card-name">{d.label}</span>
                        <span className="awd-card-desc">{d.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selected == null}
                onClick={() => selected && goConfigure(selected)}
              >
                Configure →
              </button>
            </div>
          </>
        ) : (
          selected && (
            <>
              <div className="awd-configure">
                <form
                  className="dialog-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    submit()
                  }}
                >
                  {fields.length === 0 && (
                    <p className="quiet">Nothing to configure — this widget is ready to go.</p>
                  )}
                  {fields.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      {renderField(field)}
                      {field.hint && <span className="field-hint">{field.hint}</span>}
                    </label>
                  ))}
                  {sources.isPending && selected.configSchema.some((f) => f.type === 'source') && (
                    <p className="quiet">loading sources…</p>
                  )}
                </form>
                <div className="awd-preview-pane">
                  <div className="awd-preview-stage">
                    {valid ? (
                      <WidgetFrame type={selected.type} config={previewConfig} />
                    ) : (
                      <div className="quiet">fill in the required fields to preview</div>
                    )}
                  </div>
                  <span className="awd-preview-hint">live preview · real data</span>
                </div>
              </div>
              <div className="dialog-actions">
                <button type="button" className="btn" onClick={() => setStep('gallery')}>
                  ← Back
                </button>
                <button type="button" className="btn btn-primary" disabled={!valid} onClick={submit}>
                  Add to dashboard
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}

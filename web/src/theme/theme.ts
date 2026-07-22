/** Theme switching — <html data-theme> is the single switch, tokens.css reacts.
 *  Stored choice wins; first visit follows the OS preference. */

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'portal-theme'

function storedTheme(): Theme | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'dark' || raw === 'light' ? raw : null
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

/** Runs before first render so the initial paint is already the right theme. */
export function initTheme(): void {
  applyTheme(storedTheme() ?? systemTheme())
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_KEY, next)
  applyTheme(next)
  return next
}

import type { Session } from './types'

/**
 * SSO (project 05, MoneyTrckr's DESIGN §17 pattern): the browser holds a session
 * cookie only — the backend is the OIDC client and relays tokens server-side.
 * Login is a full-page redirect into the auth service; the API authenticates by
 * cookie, mutations echo the CSRF cookie.
 */
let onSessionChange: (session: Session | null) => void = () => {}

export function setSessionListener(listener: (session: Session | null) => void) {
  onSessionChange = listener
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/**
 * Chrome refuses fetch() on URLs that embed credentials — and a relative path
 * resolves against the document URL, credentials included. location.origin
 * never carries credentials, so every request is built absolute from it.
 */
function apiUrl(path: string): string {
  return window.location.origin + path
}

function cookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

async function rawRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (init.body != null) headers.set('Content-Type', 'application/json')
  const method = (init.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = cookie('XSRF-TOKEN')
    if (csrf) headers.set('X-XSRF-TOKEN', csrf)
  }
  return fetch(apiUrl(path), { ...init, headers })
}

async function parseError(response: Response): Promise<ApiError> {
  let detail = response.statusText
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') detail = body.detail
    else if (typeof body.message === 'string') detail = body.message
    if (Array.isArray(body.errors)) detail = body.errors.join(' · ')
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(response.status, detail)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await rawRequest(path, init)
  if (response.status === 401) {
    // the app session (or the grant behind it) is gone — back to the gate
    onSessionChange(null)
    throw new ApiError(401, 'session expired')
  }
  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/** Full-page redirect into the ecosystem login (code + PKCE happens server-side). */
export function login(): void {
  window.location.href = apiUrl('/oauth2/authorization/ecosystem')
}

/** Restores the session from the cookie on page load; null = not signed in. */
export async function bootstrapSession(): Promise<Session | null> {
  const response = await rawRequest('/api/me')
  if (!response.ok) return null
  const me = (await response.json()) as Session
  onSessionChange(me)
  return me
}

/**
 * Single sign-out: POST /logout kills the app session, then the server redirects
 * through the auth service's end_session (RP-initiated logout). A real form
 * submission (not fetch) lets the browser follow that cross-origin redirect chain.
 */
export function logout(): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = apiUrl('/logout')
  const csrf = cookie('XSRF-TOKEN')
  if (csrf) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = '_csrf'
    input.value = csrf
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}

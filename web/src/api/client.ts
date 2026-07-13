import type { Session } from './types'

/**
 * The access token lives in memory only (module variable — never storage).
 * There is no refresh endpoint: on any 401 the token is dropped and the auth
 * listener sends the user back to the login page.
 */
let accessToken: string | null = null
let expiryTimer: ReturnType<typeof setTimeout> | undefined
let onAuthChange: (authed: boolean) => void = () => {}

export function setAuthListener(listener: (authed: boolean) => void) {
  onAuthChange = listener
}

export function isAuthenticated(): boolean {
  return accessToken != null
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

function dropSession() {
  if (accessToken == null) return
  accessToken = null
  clearTimeout(expiryTimer)
  onAuthChange(false)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body != null) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const response = await fetch(apiUrl(path), { ...init, headers })
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    dropSession()
    throw new ApiError(401, 'session expired')
  }
  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function login(email: string, password: string): Promise<void> {
  const session = await api<Session>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  accessToken = session.accessToken
  clearTimeout(expiryTimer)
  // proactive logout a few seconds before the token dies — beats a surprise 401
  const ms = Math.max(session.expiresIn * 1000 - 5_000, 10_000)
  expiryTimer = setTimeout(dropSession, ms)
  onAuthChange(true)
}

/** No server-side session to end (short-lived JWT) — logout is dropping the token. */
export function logout(): void {
  dropSession()
}

import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ApiError, login } from '../api/client'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { authed } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (authed) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? 'Wrong email or password.'
          : 'Could not sign in — is the API up?',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-wrap">
        {/* the portal's pulse motif, at rest — decorative only */}
        <svg className="auth-pulse" viewBox="0 0 360 36" aria-hidden="true" preserveAspectRatio="none">
          <path
            d="M0 24 H96 l6 -9 l7 16 l7 -22 l7 24 l6 -9 H222 l5 -6 l6 10 l6 -6 H360"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        <div className="auth-panel">
          <span className="eyebrow">Operator access</span>
          <div className="auth-brand">PORTAL</div>
          <p className="auth-tagline">sebastiancardona.dev — single pane of glass</p>
          <form className="auth-form" onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="auth-foot">read-only by construction</p>
        </div>
      </div>
    </div>
  )
}

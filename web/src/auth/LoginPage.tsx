import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { login } from '../api/client'
import { useAuth } from './AuthContext'

/**
 * The SSO gate. Sign-in lives on the ecosystem's auth service (project 05);
 * this page's whole job is to hand the operator off there — and to say, in
 * console vernacular, exactly where they are being sent.
 */
export function LoginPage() {
  const { authed, restoring } = useAuth()
  const location = useLocation()
  const [params] = useSearchParams()
  // Spring redirects to /login?error when the OIDC round-trip fails
  const failed = params.has('error')

  if (restoring) return null

  if (authed) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <div className="auth-brand">Portal</div>
        <p className="auth-tagline">Operations console · sebastiancardona.dev</p>
        <div className="auth-sso">
          <span className="eyebrow">Identity</span>
          <p className="auth-sso-issuer">
            <span className="mono">auth.sebastiancardona.dev</span> — one account for the
            whole ecosystem.
          </p>
          {failed && (
            <p className="form-error" role="alert">
              Sign-in didn&apos;t complete. Try again.
            </p>
          )}
          <button className="btn btn-primary auth-sso-cta" onClick={login}>
            Continue to sign in
          </button>
        </div>
        <p className="auth-foot">read-only by construction</p>
      </div>
    </div>
  )
}

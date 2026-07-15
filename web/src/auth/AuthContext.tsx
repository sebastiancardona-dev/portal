import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { bootstrapSession, setSessionListener } from '../api/client'
import type { Session } from '../api/types'

/**
 * Cookie-backed session (SSO, project 05): the BFF session cookie is the source
 * of truth; on load we bootstrap from /api/me, and any 401 clears the session so
 * route guards re-render. `restoring` gates the first paint — never flash the
 * login gate at someone who is already signed in.
 */
type AuthState = {
  authed: boolean
  session: Session | null
  restoring: boolean
}

const AuthContext = createContext<AuthState>({ authed: false, session: null, restoring: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [restoring, setRestoring] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    setSessionListener((next) => {
      setSession(next)
      if (!next) queryClient.clear() // stale ops data must not survive the session
    })
    bootstrapSession().finally(() => setRestoring(false))
    return () => setSessionListener(() => {})
  }, [queryClient])

  return (
    <AuthContext.Provider value={{ authed: session != null, session, restoring }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

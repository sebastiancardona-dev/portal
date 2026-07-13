import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isAuthenticated, setAuthListener } from '../api/client'

/**
 * Token-in-memory auth (MoneyTrckr pattern, minus refresh): the module-level
 * token in api/client.ts is the source of truth; this context mirrors it into
 * React state so route guards re-render on login/logout/401.
 */
const AuthContext = createContext<{ authed: boolean }>({ authed: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(isAuthenticated())
  const queryClient = useQueryClient()

  useEffect(() => {
    setAuthListener((next) => {
      setAuthed(next)
      if (!next) queryClient.clear() // stale ops data must not survive the session
    })
    return () => setAuthListener(() => {})
  }, [queryClient])

  return <AuthContext.Provider value={{ authed }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from '../api/client'

/**
 * Widget-only data hooks for endpoints the core api/hooks don't cover.
 * Same discipline as api/hooks.ts: 30s polling (collectors run on 30–60s
 * schedules), and a 404/401 is surfaced instead of retried.
 */

const POLL = 30_000

function retryUnlessGone(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && (error.status === 404 || error.status === 401)) return false
  return failureCount < 1
}

/** Wire shape of GET /api/deploys — the ecosystem-wide deploy feed, newest-first. */
export interface DeployFeedEvent {
  ts: string
  app: string
  env: string
  event: string
}

export function useDeploys() {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['deploys'],
    queryFn: () => api<DeployFeedEvent[]>('/api/deploys'),
    enabled: authed,
    refetchInterval: POLL,
    retry: retryUnlessGone,
  })
}

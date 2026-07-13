import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { api, ApiError } from './client'
import type {
  AppDetail,
  AppSummary,
  DashboardLayout,
  DeployEventGlobal,
  HostSnapshot,
  Me,
  Point,
  RegistryOverride,
  RegistryOverrideInput,
  SeriesBucket,
  SeriesRange,
  Source,
} from './types'

/** Collectors run on 30–60s schedules; polling any faster is noise. */
const POLL = 30_000
const SERIES_POLL = 60_000

/** A 404 means the source vanished (app undeployed) — surface it, don't retry. */
function retryUnlessGone(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && (error.status === 404 || error.status === 401)) return false
  return failureCount < 1
}

export function useMe() {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<Me>('/api/me'),
    enabled: authed,
    staleTime: Infinity,
  })
}

export function useSources() {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['sources'],
    queryFn: () => api<Source[]>('/api/sources'),
    enabled: authed,
    refetchInterval: POLL,
  })
}

export function useLatest(sourceId: string | undefined) {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['latest', sourceId],
    queryFn: () => api<Point>(`/api/sources/${encodeURIComponent(sourceId!)}/latest`),
    enabled: authed && !!sourceId,
    refetchInterval: POLL,
    retry: retryUnlessGone,
  })
}

export function useSeries(
  sourceId: string | undefined,
  range: SeriesRange,
  bucket: SeriesBucket,
  enabled = true,
) {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['series', sourceId, range, bucket],
    queryFn: () =>
      api<Point[]>(
        `/api/sources/${encodeURIComponent(sourceId!)}/series?range=${range}&bucket=${bucket}`,
      ),
    enabled: authed && !!sourceId && enabled,
    refetchInterval: SERIES_POLL,
    retry: retryUnlessGone,
  })
}

/** N series at once (e.g. latency per environment) — safe for a dynamic id list. */
export function useMultiSeries(sourceIds: string[], range: SeriesRange, bucket: SeriesBucket) {
  const { authed } = useAuth()
  return useQueries({
    queries: sourceIds.map((id) => ({
      queryKey: ['series', id, range, bucket],
      queryFn: () =>
        api<Point[]>(`/api/sources/${encodeURIComponent(id)}/series?range=${range}&bucket=${bucket}`),
      enabled: authed,
      refetchInterval: SERIES_POLL,
      retry: retryUnlessGone,
    })),
  })
}

export function useApps() {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['apps'],
    queryFn: () => api<AppSummary[]>('/api/apps'),
    enabled: authed,
    refetchInterval: POLL,
  })
}

export function useApp(app: string | undefined) {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['app', app],
    queryFn: () => api<AppDetail>(`/api/apps/${encodeURIComponent(app!)}`),
    enabled: authed && !!app,
    refetchInterval: POLL,
    retry: retryUnlessGone,
  })
}

export function useHost() {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['host'],
    queryFn: () => api<HostSnapshot>('/api/host'),
    enabled: authed,
    refetchInterval: POLL,
  })
}

/** Cross-app deploy feed — the pipeline's last 50 events, newest first. */
export function useDeploys() {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['deploys'],
    queryFn: () => api<DeployEventGlobal[]>('/api/deploys'),
    enabled: authed,
    refetchInterval: POLL,
  })
}

/* ------------------------------ registry ------------------------------- */

export function useRegistryOverrides() {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['registry'],
    queryFn: () => api<RegistryOverride[]>('/api/registry'),
    enabled: authed,
    retry: retryUnlessGone,
  })
}

/** Upsert one app's display override; apps re-fetch so the shell updates too. */
export function useSaveOverride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ app, ...input }: { app: string } & RegistryOverrideInput) =>
      api<RegistryOverride>(`/api/registry/${encodeURIComponent(app)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry'] })
      queryClient.invalidateQueries({ queryKey: ['apps'] })
    },
  })
}

/** Remove an override — the app falls back to its discovered defaults. */
export function useDeleteOverride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (app: string) =>
      api<void>(`/api/registry/${encodeURIComponent(app)}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registry'] })
      queryClient.invalidateQueries({ queryKey: ['apps'] })
    },
  })
}

export function useDashboardLayout() {
  const { authed } = useAuth()
  return useQuery({
    queryKey: ['layout'],
    queryFn: () => api<DashboardLayout>('/api/dashboard/layout'),
    enabled: authed,
    // the layout is ours alone — no point polling it; refetch on login only
    staleTime: Infinity,
  })
}

export function useSaveLayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (layout: DashboardLayout) =>
      api<void>('/api/dashboard/layout', { method: 'PUT', body: JSON.stringify(layout) }),
    onSuccess: (_data, layout) => queryClient.setQueryData(['layout'], layout),
  })
}

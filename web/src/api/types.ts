/** Wire types — mirror the backend contract exactly (see docs/DESIGN.md). */

export interface Session {
  accessToken: string
  /** seconds until the token expires (no refresh — we log out) */
  expiresIn: number
}

export interface Me {
  email: string
  role: string
  name: string
}

export type SourceKind = 'status' | 'gauge'

export interface Source {
  /** grammar: health:<app>:<env> · latency:<app>:<env> · host:<metric> · container:<name>:<metric> */
  id: string
  kind: SourceKind
  label: string
  /** omitted for unit-less sources (server drops null fields) */
  unit?: string
  app?: string
}

export interface Point {
  ts: string
  value: number
}

export type SeriesRange = '30m' | '1h' | '6h' | '24h' | '7d'
export type SeriesBucket = '1m' | '5m' | '1h'

export const SERIES_RANGES: SeriesRange[] = ['30m', '1h', '6h', '24h', '7d']
export const SERIES_BUCKETS: SeriesBucket[] = ['1m', '5m', '1h']

export interface AppEnvironment {
  env: string
  version: string
  /** null until the first /info fetch succeeds */
  gitSha: string | null
  deployStatus: string
  lastDeploy: string
  /** null = never probed (e.g. no URL discovered for this env) */
  up: boolean | null
  latencyMs: number | null
  url: string | null
}

export interface AppContainer {
  name: string
  state: string
  cpuPct: number
  memBytes: number
}

export interface AppSummary {
  app: string
  displayName: string
  icon: string
  url: string
  environments: AppEnvironment[]
  containers: AppContainer[]
}

export interface UptimeCell {
  ts: string
  upPct: number
}

export interface DeployEvent {
  ts: string
  env: string
  event: string
}

export interface AppDetail extends AppSummary {
  uptime7d: UptimeCell[]
  deployHistory: DeployEvent[]
}

export interface HostContainer {
  name: string
  cpuPct: number
  memBytes: number
}

export interface HostSnapshot {
  /** everything below is null until the host collectors have recorded data */
  ts: string | null
  cpuPct: number | null
  memUsedBytes: number | null
  memTotalBytes: number | null
  diskUsedBytes: number | null
  diskTotalBytes: number | null
  containers: HostContainer[]
}

export interface LayoutWidget {
  id: string
  type: string
  x: number
  y: number
  w: number
  h: number
  config: Record<string, string>
}

export interface DashboardLayout {
  widgets: LayoutWidget[]
}

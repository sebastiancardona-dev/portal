/** Wire types — mirror the backend contract exactly (see docs/DESIGN.md). */

/** The signed-in identity, bootstrapped from the session cookie via /api/me. */
export interface Session {
  email: string
  /** 'admin' (full) | 'viewer' (read-only: recruiter/friend) */
  role: string
  name: string
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

/** One line of the cross-app deploy feed (GET /api/deploys, newest first). */
export interface DeployEventGlobal {
  ts: string
  app: string
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
  /** the filesystem path the disk numbers are sampled at — null when no disk data */
  diskPath: string | null
  containers: HostContainer[]
}

/** Registry override (GET/PUT /api/registry) — display tweaks over discovery. */
export interface RegistryOverride {
  app: string
  displayName: string | null
  icon: string | null
  visible: boolean
  healthPath: string | null
}

/** PUT body — omitted/blank fields fall back to the discovered values. */
export interface RegistryOverrideInput {
  displayName?: string | null
  icon?: string | null
  visible?: boolean
  healthPath?: string | null
}

/* ---------------- accounts (admin — relayed from the auth service) ---------------- */

/** One app the user actually signed into (recorded at token issuance). */
export interface AppUsage {
  clientId: string
  firstUsedAt: string
  lastUsedAt: string
  useCount: number
}

export interface AccountUser {
  id: string
  email: string
  displayName: string
  groups: string[]
  disabled: boolean
  createdAt: string
  apps: AppUsage[]
}

export interface InviteRedeemer {
  email: string
  displayName: string
  redeemedAt: string
}

export interface Invite {
  id: string
  group: string
  uses: number
  maxUses: number
  expiresAt: string
  revokedAt: string | null
  note: string | null
  redemptions: InviteRedeemer[]
}

export interface MintInviteInput {
  group: string
  ttlDays: number
  maxUses: number
  note?: string
}

/** The token/registerUrl are shown exactly once — only the hash is stored. */
export interface MintedInvite {
  id: string
  token: string
  registerUrl: string
  expiresAt: string
  maxUses: number
}

export interface AuthClient {
  clientId: string
  name: string
  redirectUris: string[]
  scopes: string[]
  confidential: boolean
}

/** Raw audit row from the auth service (snake_case comes from its SQL). */
export interface AuditEvent {
  at: string
  event: string
  actor_id: string | null
  subject: string | null
  detail: Record<string, unknown> | null
  ip: string | null
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

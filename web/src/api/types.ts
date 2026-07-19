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
  /** URL fallback when Docker discovery is absent (test slot); bare host */
  baseHost: string | null
  /** GitHub repo when it differs from the app name (auth → auth-service) */
  repo: string | null
}

/** PUT body — omitted/blank fields fall back to the discovered values. */
export interface RegistryOverrideInput {
  displayName?: string | null
  icon?: string | null
  visible?: boolean
  healthPath?: string | null
  baseHost?: string | null
  repo?: string | null
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

/* ---------------- logs module (project 07 — admin, relayed from Loki) ---------------- */

export interface LogEntry {
  ts: string
  line: string
  labels: Record<string, string>
}

export interface LogSeriesPoint {
  ts: string
  value: number
}

export interface LogSeries {
  labels: Record<string, string>
  points: LogSeriesPoint[]
}

export interface LogTotal {
  labels: Record<string, string>
  value: number
}

/** kind decides which list is populated; logql echoes what actually ran. */
export interface LogsResult {
  kind: 'logs' | 'series' | 'totals'
  logql: string
  entries: LogEntry[]
  series: LogSeries[]
  totals: LogTotal[]
}

export interface LogsFields {
  available: boolean
  apps: string[]
  envs: string[]
  levels: string[]
}

export interface TailResponse {
  entries: LogEntry[]
  nowNs: string
}

/* ---------------- releases module (project 08 — GitHub cache + deploy state) ---------------- */

/** One cached GitHub release, joined with what the pipeline says is deployed. */
export interface ReleaseInfo {
  app: string
  repo: string
  tag: string
  name: string | null
  /** release notes markdown (GitHub-generated) */
  body: string | null
  prerelease: boolean
  htmlUrl: string | null
  publishedAt: string | null
  deployedProd: boolean
  deployedTest: boolean
  /** ghcr.io/<org>/<app>:<tag> — copyable pull ref */
  imageRef: string
  /** GitHub compare link vs the previous release; null for the first one */
  compareUrl: string | null
  /** JSON string: [{name,size,downloadUrl}] — null when the release has no assets */
  assets: string | null
}

export interface ReleasesFeed {
  /** false = no GitHub token configured and nothing cached yet */
  available: boolean
  lastSyncAt: string | null
  releases: ReleaseInfo[]
}

export interface AppReleases {
  available: boolean
  lastSyncAt: string | null
  app: string
  prodVersion: string | null
  testVersion: string | null
  /** stable releases prod trails the newest; null = prod not on a known release */
  prodBehind: number | null
  releases: ReleaseInfo[]
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

# Portal — Design (project 06)

> Read this before touching the repo. Companion: [OBSERVABILITY.md](OBSERVABILITY.md)
> (the ecosystem contract this app consumes). Master plan: `wrkspc/plan/00-master-plan.md`.

## What it is

The single pane of glass for the ecosystem: a configurable widget-grid dashboard,
per-app status pages, VPS host + per-container resource visibility. **Universal by
design** — apps are auto-discovered (deploy state + deploy log + Docker labels), never
hardcoded. Later it hosts the logs module (07), versions module (08), and the auth
admin/accounts dashboard (05).

Locked decisions (2026-07-12, see `plan/06-portal.md`): custom collectors → Postgres
(Prometheus is a documented future migration) · one saved layout per user · 30–60s
polling · VPS host on the main dashboard with per-container breakdown · auth behind an
interface until project 05 lands (built in parallel).

## Monorepo layout (MoneyTrckr conventions)

```
portal/
├── api/          Spring Boot 3.5 / Java 21 / Maven (wrapper) — dev.sebastiancardona.portal
├── web/          React 19 + TypeScript + Vite + react-query + react-router
├── docs/         DESIGN.md, OBSERVABILITY.md, CASE-STUDY.md (draft as we build)
├── Dockerfile    3-stage: node build → maven build (SPA into static/) → JRE runtime
└── compose.yaml  local dev: postgres:16-alpine only (spring-boot-docker-compose starts it)
```

Single container in prod: Spring serves the built SPA from `classpath:/static`
(`WebAppConfig` forwards SPA routes to index.html; hashed assets cached immutable).

## Backend architecture

```
dev.sebastiancardona.portal
├── discovery/    DeployStateReader (/data/deploy/state), DeployLogReader (…/log),
│                 DockerClient (socket proxy REST), AppCatalog (merge → App records)
├── registry/     AppOverride entity + CRUD (optional display metadata only)
├── collect/      @Scheduled collectors → HealthCollector (30s: GET /health per app+env,
│                 latency + status), HostMetricsCollector (30s: /host/proc/stat,
│                 /host/proc/meminfo; disk via FileStore of the deploy-state mount —
│                 same filesystem as /, no root mount needed), ContainerStatsCollector
│                 (60s: socket-proxy /containers/{id}/stats, CPU% + mem)
├── metrics/      MetricPoint + HealthCheck entities, retention job (14d raw),
│                 series query service (time-bucketed avg/min/max)
├── data/         Data-source API: enumerate sources, latest, series  ← widgets query this
├── dashboard/    DashboardLayout entity (one per user, jsonb) + endpoints
├── auth/         EcosystemIdentity (OIDC claims → local user), TokenRelayFilter,
│                 User/UserRepository (JIT-provisioned shadow rows), MeController
├── config/       SecurityConfig (the single auth swap surface), WebAppConfig, props
└── common/       CurrentUser, ApiExceptions, ApiExceptionHandler
```

### Discovery model (universality)

`AppCatalog` merges, keyed by app name (pipeline identity triple):
- `/data/deploy/state/*.json` → known apps + env, current version, last deploy, status
- `/data/deploy/log/deploy.log` → deploy history per app/env (parsed lines)
- Docker socket proxy → containers per app (compose labels), public URLs (Traefik
  `Host()` rules), running state; also maps DB sidecars (`<app>-db`) to their app
- `app_overrides` table → optional display name/icon/visibility/health-path

An app present in any source exists. Portal monitors itself the same way (no special-casing).

### Storage (PostgreSQL, own DB in the portal stack)

- `health_checks(id, ts, app, env, up, http_status, latency_ms)` — uptime history
- `metric_points(id, ts, source, metric, value)` — host + container series
  (source e.g. `host`, `container:moneytrckr`; metric e.g. `cpu_pct`, `mem_bytes`,
  `disk_used_bytes`). Index `(source, metric, ts desc)`.
- `app_overrides(app pk, display_name, icon, visible, health_path)`
- `users(id, email, password_hash, role)` — v1: seeded admin only; replaced by 05
- `dashboard_layouts(user_id pk, layout jsonb, updated_at)`
- Retention: nightly delete of raw points/checks older than 14d. Rollups only if the
  7d views get slow (YAGNI for ~1.6M rows).
- Flyway migrations, `ddl-auto: validate`, UUID PKs.

### Data-source API (the widget contract)

```
GET /api/sources                          → [{id, kind, label, unit, app?}]  (dynamic enumeration)
GET /api/sources/{id}/latest              → {ts, value} | {ts, up, version…} per kind
GET /api/sources/{id}/series?range=6h&bucket=5m → [{ts, value}]  (bucketed avg)
GET /api/apps                             → discovered apps + env status/version/urls/containers
GET /api/apps/{app}                       → detail: envs, uptime 7d, deploy history, containers
GET /api/host                             → latest host snapshot (cpu, mem, disk, per-container)
PUT /api/dashboard/layout                 → save my layout   GET → load (or default)
```

Source id grammar: `health:<app>:<env>` · `latency:<app>:<env>` · `host:<metric>` ·
`container:<name>:<metric>`. New apps/containers appear as new sources automatically.

### Auth (SSO — the 05 swap landed 2026-07-15)

BFF pattern, transplanted from MoneyTrckr's DESIGN §17: the backend is the OIDC
confidential client (code + PKCE against `auth.sebastiancardona.dev`); browsers
hold a session cookie only (Spring Session JDBC — deploys don't log anyone out),
tokens live server-side and auto-refresh via `OAuth2AuthorizedClientManager`.
`TokenRelayFilter` re-establishes API auth per request from the session's access
token; `EcosystemIdentity` maps ecosystem claims onto the local user row
(JIT-provisioned, linked by `uid` then email) and re-issues the Jwt with
`sub=<local UUID>` — the contract every controller already spoke. Roles:
`roles.portal` override wins, else `groups: admin` → `admin` (write), everyone
else (`recruiter`, `friend`) → `viewer` (read-only; registry writes gate on
`CurrentUser.isAdmin`). `/health` `/info` and the SPA stay public. Env:
`PORTAL_OIDC_ISSUER` / `_CLIENT_ID` / `_CLIENT_SECRET`, `PORTAL_PUBLIC_URL`,
`PORTAL_COOKIE_SECURE`. Logout is RP-initiated (`/connect/logout`). No
self-registration ever in the portal. Local rig + client registration: README
§Dev quickstart.

### Accounts module (landed 2026-07-18 — 05's admin UI lives here)

`/accounts` (admin-only: nav + palette entries hidden for viewers, route renders
a quiet refusal, API self-gates) is the auth service's admin UI. The backend is a
thin relay (`accounts/AuthAdminClient` → `/api/accounts/**`): every call forwards
the **operator's own ecosystem access token** (the local Jwt keeps the raw token
value, auto-refreshed by the BFF session) — no portal credentials, no M2M client;
authorization stays on the auth service, which re-checks the admin group. A dead
auth service degrades to an honest 502 (`UpstreamException`). Payloads pass
through untyped: the auth service owns those shapes. Views: People (users +
groups + per-app usage from 05's `user_app_activity`, recorded at token mint),
Invites (mint form → one-time link panel → list with two-step revoke), Audit
trail, OIDC clients. User group-editing/disable relays exist in the API
(`PATCH /api/accounts/users/{id}`) but have no UI yet.

### Logs module (landed 2026-07-18 — project 07)

`/logs` (admin-only, same triple gating as accounts) queries **Loki** through the
backend (`logs/LokiClient` → `/api/logs/**`; `PORTAL_LOKI_URL`, blank = module
says "not connected" honestly). The headline artifact is the **DQL compiler**
(`logs/dql/`): a DQL-inspired grammar (lexer → recursive-descent parser → AST →
LogQL compiler) covering `filter` (==, !=, contains, `level >=`, same-label or),
`summarize count() by bin()/fields`, `sort`, `limit`. Fields `app/env/level/
container` are Loki labels, `message` is the line, anything else compiles through
`| json`. The filter UI *builds* DQL into the query bar — one source of truth,
and the compiled LogQL is echoed under it. Query shapes: raw logs (merged
timeline, expandable rows), summarize-by-bin (chart), totals (ranked table).
Live tail = short-poll `/api/logs/tail` with a nanosecond cursor. A `logs-query`
widget type puts saved queries on the dashboard grid. Collection contract
(labels, JSON schema): OBSERVABILITY.md §5; infra: `stacks/observability`
(SETUP §16). Hard-won lesson: LogQL is full of `{braces}` — every Spring
UriBuilder path treats them as URI template variables, so LokiClient assembles
URIs by hand.

## Frontend architecture

Design system (accepted 2026-07-13 after two rejected rounds — see plan/06 design
history): **dark-only OLED slate** from the ui-ux-pro-max skill. Page `#0F172A`, cards
`#1E293B` with always-visible `#334155` borders, ink `#F8FAFC/#94A3B8/#64748B`
(contrast law: ≥4.5:1, `--text-3` only for ≤12px auxiliary), green `#22C55E` as the
single interaction accent, Inter for UI + JetBrains Mono for data, lucide-react icons.
Chart series = the validated colorblind-safe 8-slot set; status colors reserved and
never color-alone. Hard rule from round 2's failure: **every SVG `<text>` carries an
explicit `fill`** (default black is invisible on dark), and no UI change ships without
reading rendered screenshots (`web/scripts/shots.mjs` + `accept.mjs`).

```
web/src
├── api/          client.ts (same-origin fetch), hooks.ts (react-query, 30s refetchInterval), types.ts
├── auth/         SSO gate (redirect to the auth service) + cookie-session context
├── charts/       SVG primitives (no chart lib): TimeSeriesChart (line|area|bar,
│                 crosshair+tooltip, legend), Gauge, Donut, HeatStrip, Sparkline
├── widgets/      SDK: registry.ts — widget = {type, label, description, category,
│                 Preview, configSchema, defaultSize, minSize, component}. Nine types:
│                 stat-tile, line-chart, bar-chart, gauge, donut, uptime-heatmap,
│                 deploy-feed, status-list, table. All take an optional Title
│                 (config.label → widget header; internal subject suppressed when set)
├── grid/         gridstack wrapper: drag/resize, layout persistence; AddWidgetDialog =
│                 two-step gallery (preview vignettes by category → schema-generated
│                 config form + live preview on real data)
├── pages/        Dashboard (the grid), Apps, AppDetail, Host, Settings (registry
│                 overrides editor), Login
├── shell/        sidebar (OBSERVE / APPS w/ live status dots / MODULES 07-08-05
│                 "soon" slots / CONFIGURE), topbar (Pulse strip = live host-CPU
│                 sparkline + N/N UP lamp, Ctrl+K command palette, edit-layout)
└── theme/        tokens.css — the single token source (dark-only)
```

Default layout (served when a user has none): host CPU/memory/latency stat tiles +
CPU gauge, host CPU area chart 6h + app status list, container-memory donut +
deploy feed + containers table.

## Prod stack (deploy via pipeline 03)

`/opt/stacks/portal/docker-compose.yml` (registered manually by Juanse, root):

```
portal        ghcr.io/sebastiancardona-dev/portal:<pin>   (Traefik: portal.sebastiancardona.dev)
  mounts: /opt/deploy/state:/data/deploy/state:ro, /opt/deploy/log:/data/deploy/log:ro,
          /proc:/host/proc:ro   (NO root-fs mount: it would expose every stack's .env
          secrets read-only. Disk stats come from statvfs on the state mount, which
          lives on the same filesystem as / — deliberate least-privilege decision.)
  env: DB_*, PORTAL_OIDC_ISSUER/_CLIENT_ID/_CLIENT_SECRET, PORTAL_PUBLIC_URL,
       DOCKER_API=http://portal-docker-proxy:2375
portal-db     postgres:16-alpine (named volume)
portal-docker-proxy  tecnativa/docker-socket-proxy  (CONTAINERS=1, everything else 0;
  NOT on the proxy network — internal only. Read-only Docker API = the security story.)
```

Test env: `portal` service slot in `/opt/stacks/apps-test/` → `portal-test.sebastiancardona.dev`.
Onboarding: two ~15-line workflow callers + `VPS_SSH_KEY` secret + Dockerfile honoring
`VERSION`/`GIT_SHA`/`BUILD_TIME` + `/health` `/info` + Docker HEALTHCHECK.

## Boundaries / honesty notes

- Read-only by construction: the portal can *see* everything, *change* nothing
  (socket proxy blocks all mutating Docker endpoints; state/log mounts are `:ro`).
- Postgres-as-TSDB is a deliberate, documented trade-off; the Prometheus migration is
  the case study's "evolution" chapter.
- Out of scope for MVP: alerting, SLO/error budgets, public status page, multiple
  named dashboards, SSE push, logs (07), versions/artifacts (08), accounts UI for
  user group-editing/disable (relay endpoint already live).

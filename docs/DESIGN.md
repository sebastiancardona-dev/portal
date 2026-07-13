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
├── auth/         IdentityProvider interface (formalized — 05 swaps the impl),
│                 v1 impl: local login, single admin from env, short-lived HS256 JWT
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

### Auth seam

`IdentityProvider` interface + `SecurityConfig` are the only OIDC-touching surfaces.
v1: `/api/auth/login` (admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env, Argon2id),
30-min HS256 JWT (`JWT_SECRET`), everything under `/api/**` authenticated except
`/api/auth/**`; `/health` `/info` and the SPA public. When 05 lands: OIDC
code+PKCE, groups claim → `admin` (write) / `recruiter` (read-only), accounts
dashboard fed by 05's admin API. No self-registration ever in the portal.

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
├── auth/         login page + token-in-memory context (MoneyTrckr pattern)
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
  env: DB_*, JWT_SECRET, ADMIN_*, DOCKER_API=http://portal-docker-proxy:2375
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
  named dashboards, SSE push, logs (07), versions/artifacts (08), accounts view (post-05).

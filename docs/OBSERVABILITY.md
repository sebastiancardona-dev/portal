# Ecosystem Observability Contract

> Defined by project 06 (Portal). Every app in the ecosystem implements this contract;
> the Portal consumes it. Adding a new app requires **zero Portal changes** — if the app
> follows this contract and deploys through the pipeline (project 03), the Portal
> discovers and monitors it automatically.

Status: **v1** (2026-07-12). Reference implementation: MoneyTrckr (`/health` + `/info`
via Spring Actuator remapped to root).

## 1. Endpoints (dynamic apps: Spring Boot, Node, …)

| Endpoint | Method | Auth | Contract |
|----------|--------|------|----------|
| `/health` | GET | public | `200` = healthy, anything else = unhealthy. Body free-form (Actuator's `{"status":"UP"}` is fine). |
| `/info` | GET | public | `200` + JSON with at least the keys below. |

`/info` must expose version, git sha, and build time in **either** accepted shape
(both exist in production today; consumers parse both):

```json
// flat (static apps: pipeline-baked JSON)
{ "app": "swiss-dev-tools", "version": "v0.1.0", "git_sha": "d484b14…", "build_time": "2026-07-11T16:58:04-06:00" }

// Spring Actuator native (moneytrckr)
{ "app": { "version": "v0.4.0", "git": { "sha": "7c5010e…" }, "build": { "time": "2026-07-12T13:33:01-06:00" } } }
```

Timestamps are ISO-8601 with offset (`Z` or `±hh:mm`).

Values come from the pipeline's Docker build args `VERSION`, `GIT_SHA`, `BUILD_TIME`
(already part of the project-03 onboarding contract). Spring apps: map build args to
`INFO_APP_*` env vars and enable the env info contributor; remap Actuator to root
(`management.endpoints.web.base-path: /`) exposing **only** `health,info`.

## 2. Static apps (nginx-served SPAs / sites)

Same URLs, baked at image build time:

- `/health` → static file containing `ok` (nginx serves it `200`).
- `/info` → static JSON in the schema above, generated in the Dockerfile from the
  same three build args (a 4-line `RUN printf … > /usr/share/nginx/html/info` step).

Applies to: swiss-dev-tools, hello-ecosystem, portfolio.

## 3. Discovery (how the Portal finds apps — no hardcoding, ever)

The Portal merges three sources, keyed by the pipeline's identity triple
(**app name = image name = stack dir/service name**):

1. **Deploy state** — `/opt/deploy/state/<app>-<env>.json`
   (`{app, env, version, status, timestamp}`; env ∈ `prod`,`test`). One file per
   app+env, latest deploy only. Mounted read-only into the Portal container.
2. **Deploy history** — `/opt/deploy/log/deploy.log`, append-only lines
   `<ISO-ts> [<app>/<env>] <event>` (requested/healthy/FAILED/rollback). Read-only mount.
3. **Docker runtime** — via a **read-only socket proxy** (containers list + stats only):
   - `com.docker.compose.project` / `.service` labels → app↔container mapping
     (prod stack dir = app; test = service slot in `apps-test`).
   - `traefik.http.routers.*.rule` `Host(...)` labels → the app's public URLs.
   - Container state + per-container CPU/RAM stats → resource attribution.

An app appearing in any source is registered automatically. The Portal's own registry
table stores **optional overrides only** (display name, icon, hide-from-recruiters,
health-path override) — never required for an app to show up.

## 4. Usage metrics (contract v1.1 — staged rollout)

For request counts / active users, each dynamic app will expose `GET /metrics`
(JSON, public-safe, no PII):

```json
{ "requests_total": 12345, "requests_5xx_total": 12, "active_users_24h": 3 }
```

Implemented as a tiny servlet-filter/middleware per stack. **Not required for Portal
MVP** — rollout is deferred until after project 05 lands (avoids touching MoneyTrckr's
repo while its OIDC migration is in flight). The Portal treats `/metrics` as optional:
absent → usage widgets show "no data" for that app.

## 5. Logging

Structured JSON logging contract is defined by project 07 (see `plan/07-logs-observability.md`);
this document only reserves the requirement. Portal MVP does not consume logs.

## 6. Compliance snapshot (2026-07-12)

| App | /health | /info | Notes |
|-----|---------|-------|-------|
| moneytrckr | ✅ | ✅ | Actuator at root; nested `/info` shape. |
| swiss-dev-tools | ✅ | ✅ | Flat `/info`, baked at build (verified live 2026-07-12). |
| hello-ecosystem | ✅ | ✅ | Flat `/info`, baked at build (verified live 2026-07-12). |
| portfolio | ✅ | ✅ | Flat `/info`, baked at build (verified live 2026-07-12). |
| auth-service (05) | 🔜 | 🔜 | Building in parallel — implements §1 from day one. |
| portal (this app) | 🔜 | 🔜 | Implements §1 from day one; monitors itself like any other app. |

No retrofits were needed: the project-03 pipeline already required this contract at
onboarding, so every deployed app was born compliant. §2 stays as the recipe for
future static apps.

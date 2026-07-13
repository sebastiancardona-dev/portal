# Case Study — Portal: an ops dashboard that discovers its own ecosystem

> Draft — grows as the project ships. Format: problem → constraints → architecture →
> trade-offs → results (same as the other ecosystem case studies).

## Problem

Seven apps across prod + test environments on one VPS, deployed by a gated pipeline —
and no single place to answer: is everything up? what version is where? what's eating
the RAM? Commercial answers (Datadog, Grafana Cloud, Dynatrace) violate the ecosystem's
fixed-cost rule before the first dashboard loads.

## Constraints

- Same €10–15/mo cap as everything else: the monitor must fit on the machine it monitors
  (~4GB RAM VPS already running 13 containers) — the observer can't be heavier than the observed.
- **Universal by contract, not by configuration**: adding app #8 to the ecosystem must
  light it up on the dashboard with zero portal changes. No hardcoded app lists.
- Read-only by construction: a dashboard with root-level reach is an attack surface,
  not a tool.
- Parallel-build constraint: developed while the SSO provider (project 05) was being
  built in another session — auth had to be a swappable seam, not a dependency.

## Architecture decisions (and their honest trade-offs)

1. **Observability contract over agents.** Every app already implements `/health` +
   `/info` (the deploy pipeline required it from day one — §6 of OBSERVABILITY.md shows
   the contract was retroactively free). The portal consumes contracts; it never
   instruments apps.
2. **Discovery = deploy state ∪ deploy log ∪ Docker labels.** The pipeline (project 03)
   already writes `/opt/deploy/state/<app>-<env>.json` and an append-only deploy log;
   Traefik routing labels already encode every public URL. The portal merges what the
   platform already knows about itself — the registry table stores optional display
   overrides only. *(The 03 case study predicted "the same log a future ops dashboard
   will read" — this is that dashboard.)*
3. **Custom collectors → Postgres, not Prometheus (yet).** ~40 metrics at 30–60s on one
   host is ~1.6M rows per 14-day retention window — comfortably Postgres territory, and
   the collectors/series code is portfolio material. The Prometheus/node_exporter swap
   is the documented evolution path; the data-source API is the isolation layer that
   makes the swap invisible to widgets.
4. **Least-privilege reads.** Deploy state/log and host `/proc` mounted `:ro`; **no
   host-root mount** (it would expose every stack's `.env` — disk stats instead come
   from `statvfs` on the state mount, same filesystem as `/`); Docker API only via a
   socket proxy allowing `GET /containers/*` and nothing else, on an internal-only
   network. The portal can see everything and change nothing.
5. **Widget SDK.** A widget type = one module: `{type, configSchema, defaultSize,
   minSize, component}`; the add-widget dialog renders any config schema generically
   and data sources are enumerated at runtime (`health:<app>:<env>`, `host:cpu_pct`,
   `container:<name>:mem_bytes`, …) — new apps and containers become new widget
   sources automatically. Same registry philosophy as the Swiss Tool (project 02).
6. **Auth as a seam.** `IdentityProvider` + `SecurityConfig` are the only files the
   project-05 OIDC swap touches. v1 is a single env-seeded admin with short-lived JWTs;
   the accounts dashboard (who's registered, per-app last-use) lands with 05's admin API.

## Results

*(to fill at launch: deployed URL, default dashboard screenshot, RAM footprint of the
portal stack itself, time-to-discover for a new app, case of the portal monitoring
itself)*

## What I'd do differently

*(to fill honestly at the end)*

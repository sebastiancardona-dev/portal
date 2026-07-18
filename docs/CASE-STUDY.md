# Case Study — Portal: an ops dashboard that discovers its own ecosystem

> Live at https://portal.sebastiancardona.dev (v0.1.0 2026-07-18; accounts module +
> registry `baseHost` in v0.2.0 the same day). Format: problem → constraints →
> architecture → trade-offs → results (same as the other ecosystem case studies).

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
6. **Auth as a seam — and the seam paid off.** v1 shipped with a single env-seeded
   admin behind an `IdentityProvider` interface. The project-05 OIDC swap replaced it
   with the BFF pattern (backend = confidential client, browser holds only a session
   cookie, tokens server-side with auto-refresh) touching exactly the seam files:
   `SecurityConfig`, plus the new `EcosystemIdentity` mapper and `TokenRelayFilter`.
   Every controller kept its Jwt contract unchanged. Recruiters land as read-only
   viewers via group mapping; JIT provisioning links ecosystem accounts to local rows.
7. **The accounts module relays the operator's own token.** The auth service's admin
   API needs a bearer with the `admin` group — and the obvious design (a
   machine-to-machine client for the portal) is the wrong one: it would mint a second,
   always-on admin credential to protect. Instead `/api/accounts/**` forwards the
   logged-in operator's own access token (the BFF session refreshes it transparently).
   Authorization stays on the auth service; a viewer who somehow reached the endpoint
   is refused twice — by the portal's gate and by the upstream group check. A dead
   auth service degrades to an honest 502, never a hang or a blank page. "Which apps
   does this person actually use" is answered durably by 05's `user_app_activity`
   (upserted at access-token issuance — the one point where user and client meet on
   every grant, refreshes included).

## Results

- **Live**: https://portal.sebastiancardona.dev — SSO via the ecosystem's own OIDC
  provider; recruiters get a read-only invite, the same dashboard, and zero fake data.
- **Footprint**: the prod portal stack (app + Postgres + docker-socket-proxy) runs in
  **~390 MiB** on the 3.8 GiB VPS it monitors, alongside the ~20 containers it watches.
  The observer is ~10% of the observed — the fixed-cost rule held.
- **Universality proven in production**: the portal discovered all five ecosystem apps
  (plus itself) from deploy state + Docker labels with an empty registry table. Adding
  an app to the ecosystem requires zero portal changes; the registry stores display
  tweaks and the optional `baseHost` URL fallback for environments without Docker
  discovery (the test slot proved that gap by design: all-N/A App Status until the
  convention-based URL derivation landed).
- **The portal monitors itself** honestly: its own health probes, container stats and
  deploy history appear with no special-casing, and the test instance live-proved the
  viewer role when a stale demo session landed read-only on it.
- **Auth admin ops moved from curl to UI**: invite minting (one-time link, two-step
  revoke), user/group visibility with per-app last-used, and the audit trail — the
  headless admin API (project 05's locked decision) finally got its interface, in the
  portal, exactly as planned two projects earlier.

## Screenshots

Rendered from the local rig (`web/scripts/shots.mjs` — the same screenshot-verification
loop every UI change must pass): [dashboard](screenshots/01-dashboard.png) ·
[accounts module](screenshots/02-accounts.png) ·
[invite minted — one-time link](screenshots/03-accounts-invite-minted.png) ·
[registry settings](screenshots/04-settings-registry.png) ·
[accounts on mobile](screenshots/05-accounts-mobile.png)

## What I'd do differently

- Land `baseHost` (or any URL convention) in v0.1.0: shipping the test env with
  all-N/A App Status was "by design," but a design that reads as broken on first
  glance costs more than the field would have.
- The widget SDK's config schema became the de-facto contract for three dialogs;
  I'd formalize it earlier instead of letting the add-widget dialog define it by
  accident.
- Prometheus stays the right "later": nothing in 14 days of Postgres series data
  pushed against the retention/aggregation ceiling. The documented swap path is
  still the plan, not a regret.

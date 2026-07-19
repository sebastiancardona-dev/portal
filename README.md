# Portal

The single pane of glass for the ecosystem (project 06): a configurable
widget-grid dashboard, per-app status pages, and VPS host + per-container
resource visibility. Apps are **auto-discovered** from deploy state, the deploy
log and Docker labels — never hardcoded. Read
[docs/DESIGN.md](docs/DESIGN.md) before touching the repo;
[docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) is the ecosystem contract the
portal consumes (and implements itself).

## Layout

```
api/          Spring Boot 3.5 / Java 21 / Maven wrapper — dev.sebastiancardona.portal
web/          React 19 + TypeScript + Vite
docs/         DESIGN.md, OBSERVABILITY.md
Dockerfile    3-stage: node build → maven build (SPA into static/) → JRE runtime
compose.yaml  local dev Postgres only (port 5433; spring-boot-docker-compose starts it)
```

## Dev quickstart

Requirements: Java 21, Node 22, Docker (for the dev DBs and integration tests).

Identity lives on the auth service (project 05) — the local rig runs it on :9000
(its own Postgres goes on 5434 so it coexists with portal's on 5433):

```sh
# 1. auth service on :9000 (from the auth-service repo)
docker run -d --name auth-dev-pg-5434 -e POSTGRES_DB=auth -e POSTGRES_USER=auth \
  -e POSTGRES_PASSWORD=dev-only -p 5434:5432 postgres:16-alpine
SERVER_PORT=9000 AUTH_ISSUER=http://localhost:9000 \
  DB_URL=jdbc:postgresql://localhost:5434/auth \
  ./mvnw spring-boot:run "-Dspring-boot.run.profiles=local" \
  "-Dspring-boot.run.arguments=--spring.docker.compose.enabled=false"

# 2. register the `portal` OIDC client (headless PKCE login as the seeded admin;
#    prints the client secret once)
python scripts/register-local-oidc-client.py

# 3. API — the local profile auto-starts the compose Postgres and points
#    discovery at the checked-in fixtures in api/dev-fixtures/.
cd api && PORTAL_OIDC_CLIENT_SECRET=<from step 2> \
  ./mvnw spring-boot:run "-Dspring-boot.run.profiles=local"

# 4. Web (separate terminal)
cd web && npm run dev

# 5. (optional) logs module data — the compose Postgres step also started a
#    local Loki on :3100; give it something to show:
node scripts/seed-local-loki.mjs
```

Releases module (project 08) data: start the API with
`PORTAL_GITHUB_TOKEN="$(gh auth token)"` and the sync pulls real releases within
seconds. Two apps need a repo override first (Settings → GitHub repo, or SQL):
`auth` → `auth-service`, `portfolio` → `sebastiancardona-dev.github.io`.

Sign in at http://localhost:5173 as `juanse@local.dev` / `local-admin-password`
(the auth service's seeded local admin). Steps 1–2 are once per dev machine —
the containers keep their data across restarts (step 1's DB has no volume; if
you remove the container, rerun step 2).

## Tests

```sh
cd api
./mvnw -B verify                 # unit tier (pure JVM, no Docker)
./mvnw -B verify -Pintegration   # + Testcontainers integration tests
```

## Deploy

Ships through pipeline 03 like every other app: `test-env.yml` deploys each
branch push to portal-test, `release.yml` deploys version tags to prod. The
image answers `/health` and `/info` (Actuator remapped to root) per the
observability contract.

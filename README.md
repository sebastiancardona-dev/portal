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

Requirements: Java 21, Node 22, Docker (for the dev DB and integration tests).

```sh
# API — the local profile auto-starts the compose Postgres and seeds an admin
# (juanse@local.dev / local-admin-password), and points discovery at the
# checked-in fixtures in api/dev-fixtures/.
cd api && ./mvnw spring-boot:run "-Dspring-boot.run.profiles=local"

# Web (separate terminal)
cd web && npm run dev
```

Running `docker compose up -d` yourself is optional — the local profile manages
the DB container for you.

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

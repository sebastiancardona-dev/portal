// Seed the local Loki (compose.yaml service, :3100) with realistic ecosystem
// logs so the logs module has data on the dev rig. Mirrors the Alloy label
// contract: job=docker, app, env, container, level.
// Usage: node scripts/seed-local-loki.mjs [lokiUrl]

const LOKI = process.argv[2] ?? 'http://localhost:3100'

const APPS = [
  { app: 'portal', env: 'prod', container: 'portal' },
  { app: 'portal', env: 'test', container: 'apps-test-portal-1' },
  { app: 'auth', env: 'prod', container: 'auth' },
  { app: 'moneytrckr', env: 'prod', container: 'moneytrckr' },
  { app: 'proxy', env: 'prod', container: 'traefik' },
]

const LINES = {
  INFO: [
    ['d.s.p.collect.HealthCollector', 'health probe ok for {} in {}ms'],
    ['d.s.a.web.PageController', 'login page served'],
    ['d.s.m.api.EntryController', 'entry actualized for ledger {}'],
    ['o.s.web.servlet.DispatcherServlet', 'Completed initialization in {} ms'],
  ],
  WARN: [
    ['d.s.p.discovery.DockerClient', 'stats fetch slow ({}ms) for container {}'],
    ['d.s.a.web.LoginRateLimitFilter', 'rate limit warning for ip {}'],
  ],
  ERROR: [
    ['d.s.p.collect.HealthCollector', 'health probe timeout for moneytrckr-test'],
    ['d.s.m.api.ImportController', 'csv import failed: column mismatch at row {}'],
  ],
}

const rand = (n) => Math.floor(Math.random() * n)
const pick = (arr) => arr[rand(arr.length)]

const streams = new Map()
const now = Date.now()

for (let i = 0; i < 900; i++) {
  const target = pick(APPS)
  const roll = rand(100)
  const level = roll < 82 ? 'INFO' : roll < 94 ? 'WARN' : 'ERROR'
  const [logger, template] = pick(LINES[level])
  const ts = now - rand(6 * 3600 * 1000) // spread over the last 6h
  const requestId = Math.random().toString(16).slice(2, 10)
  const line =
    target.app === 'proxy'
      ? `${new Date(ts).toISOString()} 200 GET /api/sources ${rand(120)}ms` // raw, non-JSON
      : JSON.stringify({
          timestamp: new Date(ts).toISOString(),
          level,
          logger,
          message: template.replaceAll('{}', String(rand(500))),
          requestId,
        })
  const labels =
    target.app === 'proxy'
      ? { job: 'docker', app: target.app, env: target.env, container: target.container }
      : { job: 'docker', app: target.app, env: target.env, container: target.container, level }
  const key = JSON.stringify(labels)
  if (!streams.has(key)) streams.set(key, { stream: labels, values: [] })
  streams.get(key).values.push([`${ts}000000`, line])
}

for (const s of streams.values()) s.values.sort((a, b) => (a[0] < b[0] ? -1 : 1))

const res = await fetch(`${LOKI}/loki/api/v1/push`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ streams: [...streams.values()] }),
})
if (!res.ok) {
  console.error('push failed:', res.status, await res.text())
  process.exit(1)
}
console.log(`seeded ${[...streams.values()].reduce((n, s) => n + s.values.length, 0)} lines into ${LOKI}`)

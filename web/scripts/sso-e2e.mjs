// SSO end-to-end proof against the local rig (auth-service :9000, API :8080,
// Vite :5173 — see api/src/main/resources/application-local.yml header).
// Drives the REAL OIDC round-trip: gate → auth login form → PKCE code flow →
// back on the dashboard with a cookie session → logout through end_session.
// Usage: node scripts/sso-e2e.mjs <outDir>
import { chromium } from 'playwright'

const outDir = process.argv[2] ?? 'shots'
const base = 'http://localhost:5173'
const shot = (page, name) =>
  page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const fail = (msg) => {
  console.error(`FAIL: ${msg}`)
  process.exitCode = 1
}

// 1. unauthenticated → the SSO gate
await page.goto(`${base}/`)
await page.waitForURL('**/login')
await page.waitForSelector('.auth-sso-cta')
await shot(page, 'sso-01-gate')

// 2. hand-off to the auth service (full-page redirect, PKCE server-side)
await page.click('.auth-sso-cta')
await page.waitForSelector('input[name="username"]')
if (!page.url().startsWith('http://localhost:9000')) fail(`expected auth service, got ${page.url()}`)
await shot(page, 'sso-02-auth-login')

// 3. sign in as the seeded local admin → back on the dashboard, cookie session
await page.fill('input[name="username"]', 'juanse@local.dev')
await page.fill('input[name="password"]', 'local-admin-password')
await page.click('button[type="submit"]')
await page.waitForURL(`${base}/`, { timeout: 15_000 })
await page.waitForSelector('.dash-toolbar, .gs-item, [class*=widget]', { timeout: 15_000 })
await page.waitForTimeout(1200) // let widgets settle before the picture
await shot(page, 'sso-03-dashboard')

const me = await page.evaluate(() =>
  fetch('/api/me').then((r) => (r.ok ? r.json() : { status: r.status })))
if (me.role !== 'admin') fail(`/api/me role: ${JSON.stringify(me)}`)
console.log('me:', JSON.stringify(me))

// 4. survive a full reload (session cookie, not in-memory token)
await page.reload()
await page.waitForSelector('.dash-toolbar, .gs-item, [class*=widget]', { timeout: 15_000 })
if (page.url() !== `${base}/`) fail(`reload bounced to ${page.url()}`)

// 5. logout → RP-initiated end_session on the auth service
await page.click('button[title="Sign out"], [aria-label="Sign out"]').catch(async () => {
  // fall back to the client logout() the shell button calls
  await page.evaluate(() => import('/src/api/client.ts').then((m) => m.logout()))
})
await page.waitForTimeout(2500)
console.log('after logout:', page.url())
const meAfter = await page.request.get(`${base}/api/me`)
if (meAfter.status() !== 401) fail(`/api/me after logout: ${meAfter.status()} (want 401)`)

await browser.close()
console.log(process.exitCode ? 'E2E FAILED' : 'E2E OK')

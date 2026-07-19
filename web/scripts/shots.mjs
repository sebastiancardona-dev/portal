/* Screenshot sweep for the redesign verification loop.
 * Run from web/: node scripts/shots.mjs [outDir]
 * SSO: sign-in happens on the local auth service (:9000, see api README);
 * the session is a cookie, so page.goto after login is fine now.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT =
  process.argv[2] ??
  'C:\\Users\\Juanse\\AppData\\Local\\Temp\\claude\\C--Users-Juanse-wrkspc\\ab404def-97ee-4117-80c4-b592995e1f24\\scratchpad\\shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })

try {
  // ---- login page ----
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
  await page.waitForSelector('.auth-panel')
  await page.waitForTimeout(400)
  await shot('01-login')

  // ---- sign in (redirect through the local auth service) ----
  await page.click('.auth-sso-cta')
  await page.waitForSelector('input[name="username"]')
  await page.fill('input[name="username"]', 'juanse@local.dev')
  await page.fill('input[name="password"]', 'local-admin-password')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.grid-stack', { timeout: 15000 })
  await page.waitForTimeout(3500) // let charts and polls land
  await shot('02-dashboard')

  // ---- edit mode ----
  await page.click('button:has-text("Edit layout")')
  await page.waitForTimeout(700)
  await shot('03-dashboard-edit')

  // ---- add-widget dialog: gallery ----
  await page.click('button:has-text("Add widget")')
  await page.waitForSelector('.awd-dialog')
  await page.waitForTimeout(500)
  await shot('04-add-widget-gallery')

  // ---- add-widget dialog: configure (pick the line chart) ----
  await page.click('.awd-card:has-text("Line chart")')
  await page.click('button:has-text("Configure")')
  await page.waitForTimeout(2000) // live preview against real data
  await shot('05-add-widget-configure')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.click('button:has-text("Done editing")')
  await page.waitForTimeout(900)

  // ---- command palette ----
  await page.keyboard.press('Control+k')
  await page.waitForSelector('.palette')
  await page.waitForTimeout(400)
  await shot('06-palette')
  await page.keyboard.press('Escape')

  // ---- apps ----
  await page.click('a[href="/apps"]')
  await page.waitForSelector('.card-grid, .quiet', { timeout: 10000 })
  await page.waitForTimeout(800)
  await shot('07-apps')

  // ---- app detail ----
  await page.click('a[href="/apps/moneytrckr"]')
  await page.waitForSelector('.env-blocks', { timeout: 10000 })
  await page.waitForTimeout(2500)
  await shot('08-app-detail')

  // ---- host ----
  await page.click('a[href="/host"]')
  await page.waitForSelector('.tile-row', { timeout: 10000 })
  await page.waitForTimeout(2500)
  await shot('09-host')

  // ---- settings ----
  await page.click('a[href="/settings"]')
  await page.waitForSelector('.settings-table, .quiet', { timeout: 10000 })
  await page.waitForTimeout(600)
  await shot('10-settings')

  // ---- accounts (admin module: SSO users, invites, audit) ----
  await page.click('a[href="/accounts"]')
  await page.waitForSelector('.mint-form', { timeout: 10000 })
  await page.waitForTimeout(800)
  await shot('12-accounts')

  // mint an invite so the one-time link panel renders
  await page.selectOption('.mint-form select', 'recruiter')
  await page.fill('.mint-form .mint-note input', 'screenshot drill')
  await page.click('button:has-text("Mint invite")')
  await page.waitForSelector('.mint-result', { timeout: 10000 })
  await page.waitForTimeout(400)
  await shot('13-accounts-minted')

  // arm the revoke on the invite we just minted (destructive two-step)
  await page.click('tr:has-text("screenshot drill") button:has-text("Revoke")')
  await page.waitForTimeout(300)
  await shot('14-accounts-revoke-armed')
  await page.click('button:has-text("Confirm revoke")')
  await page.waitForTimeout(600)

  // ---- logs module (needs the local Loki seeded: scripts/seed-local-loki.mjs) ----
  await page.click('a[href="/logs"]')
  await page.waitForSelector('.logs-toolbar', { timeout: 10000 })
  await page.waitForTimeout(1200)
  await shot('20-logs')

  // a summarize query -> chart
  await page.fill('.logs-query-input',
    'fetch logs | filter level >= "WARN" | summarize count() by bin(15m), app')
  await page.click('.logs-querybar button[type="submit"]')
  await page.waitForTimeout(1500)
  await shot('21-logs-series')

  // top-N totals
  await page.fill('.logs-query-input',
    'fetch logs | summarize count() by app | sort desc | limit 5')
  await page.click('.logs-querybar button[type="submit"]')
  await page.waitForTimeout(1200)
  await shot('22-logs-totals')

  // expanded line + live tail armed
  await page.fill('.logs-query-input', 'fetch logs | filter level == "ERROR"')
  await page.click('.logs-querybar button[type="submit"]')
  await page.waitForTimeout(1200)
  await page.click('.log-row >> nth=0')
  await page.waitForTimeout(400)
  await shot('23-logs-expanded')
  await page.click('button:has-text("Live tail")')
  await page.waitForTimeout(3000)
  await shot('24-logs-tail')
  await page.click('button:has-text("Stop tail")')

  // ---- accounts, mobile ----
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(800)
  await shot('15-accounts-mobile')
  await page.setViewportSize({ width: 1440, height: 900 })

  // ---- mobile dashboard (viewport resize keeps the in-memory session) ----
  await page.click('a[href="/"]')
  await page.waitForSelector('.grid-stack', { timeout: 10000 })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(2000)
  await shot('11-mobile-dashboard')

  console.log('done ->', OUT)
} finally {
  await browser.close()
}

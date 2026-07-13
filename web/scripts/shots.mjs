/* Screenshot sweep for the redesign verification loop.
 * Run from web/: node scripts/shots.mjs [outDir]
 * Auth token is in-memory only — navigate via the SPA, never page.goto after login.
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

  // ---- sign in ----
  await page.fill('input[type=email]', 'juanse@local.dev')
  await page.fill('input[type=password]', 'local-admin-password')
  await page.click('button:has-text("Sign in")')
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

/* Screenshot sweep for the releases module (project 08).
 * Run from web/: node scripts/shots-releases.mjs [outDir]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] ?? 'shots-08'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })

try {
  // ---- sign in ----
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
  await page.click('.auth-sso-cta')
  await page.waitForSelector('input[name="username"]')
  await page.fill('input[name="username"]', 'juanse@local.dev')
  await page.fill('input[name="password"]', 'local-admin-password')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.grid-stack', { timeout: 15000 })

  // ---- releases page: ecosystem feed ----
  await page.click('a[href="/releases"]')
  await page.waitForSelector('.logs-toolbar', { timeout: 10000 })
  await page.waitForTimeout(1200)
  await shot('01-releases-feed')

  // ---- expanded artifact panel ----
  await page.click('.log-row >> nth=0')
  await page.waitForTimeout(500)
  await shot('02-releases-artifacts')

  // copy feedback state
  await page.click('.rel-cmd button')
  await page.waitForTimeout(250)
  await shot('03-releases-copied')

  // ---- per-app timeline (moneytrckr: 6 releases, deployed markers) ----
  await page.selectOption('.logs-toolbar select', 'moneytrckr')
  await page.waitForSelector('.rel-summary', { timeout: 10000 })
  await page.waitForTimeout(800)
  await shot('04-releases-app-timeline')

  // expand one there too
  await page.click('.log-row >> nth=1')
  await page.waitForTimeout(500)
  await shot('05-releases-app-expanded')

  // ---- settings: the new GitHub repo column ----
  await page.click('a[href="/settings"]')
  await page.waitForSelector('.settings-table', { timeout: 10000 })
  await page.waitForTimeout(600)
  await shot('06-settings-repo-column')

  // ---- add-widget gallery: recent releases card ----
  await page.click('a[href="/"]')
  await page.waitForSelector('.grid-stack', { timeout: 10000 })
  await page.click('button:has-text("Edit layout")')
  await page.waitForTimeout(500)
  await page.click('button:has-text("Add widget")')
  await page.waitForSelector('.awd-dialog')
  await page.waitForTimeout(400)
  await shot('07-widget-gallery')

  // configure + live preview of the releases widget
  await page.click('.awd-card:has-text("Recent releases")')
  await page.click('button:has-text("Configure")')
  await page.waitForTimeout(1500)
  await shot('08-widget-configure')

  // actually add it and show it on the dashboard
  await page.click('.awd-dialog button:has-text("Add")')
  await page.waitForTimeout(1200)
  await page.click('button:has-text("Done editing")')
  await page.waitForTimeout(800)
  await shot('09-dashboard-with-widget')

  // ---- mobile ----
  await page.click('a[href="/releases"]')
  await page.waitForSelector('.logs-toolbar', { timeout: 10000 })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(900)
  await shot('10-releases-mobile')

  console.log('done ->', OUT)
} finally {
  await browser.close()
}

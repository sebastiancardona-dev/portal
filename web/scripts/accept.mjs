/* Acceptance proofs for the three named defects:
 *   dashboard-axes.png  — line-chart WIDGET axis ticks legible on the grid
 *   dialog-step1/2.png  — add-widget dialog visible above the grid, both steps
 *   gauge-large.png     — gauge widget resized to ~6x4, scales to fill
 *   empty-dashboard.png — empty-layout path (layout GET intercepted)
 * Run from web/: node scripts/accept.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT =
  process.argv[2] ??
  'C:\\Users\\Juanse\\AppData\\Local\\Temp\\claude\\C--Users-Juanse-wrkspc\\ab404def-97ee-4117-80c4-b592995e1f24\\scratchpad\\shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

async function login(page) {
  // SSO: redirect through the local auth service (:9000, see api README)
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
  await page.click('.auth-sso-cta')
  await page.waitForSelector('input[name="username"]')
  await page.fill('input[name="username"]', 'juanse@local.dev')
  await page.fill('input[name="password"]', 'local-admin-password')
  await page.click('button[type="submit"]')
  await page.waitForURL('http://localhost:5173/**')
}

// ---------- main pass: axes, dialog steps, large gauge ----------
// retry the whole pass on a fresh page if a transient hiccup bounces it mid-run
let attempt = 0
main: while (true) {
  attempt++
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })

  try {
    await login(page)
    await page.waitForSelector('.grid-stack', { timeout: 15000 })
    await page.waitForTimeout(3500)
    await shot('dashboard-axes')

    // edit mode + dialog step 1
    await page.click('button:has-text("Edit layout")', { timeout: 10000 })
  await page.waitForTimeout(500)
  await page.click('button:has-text("Add widget")')
  await page.waitForSelector('.awd-dialog')
  await page.waitForTimeout(500)
  await shot('dialog-step1')

  // step 2: configure a Gauge (live preview) — match the card NAME exactly,
  // several card descriptions also contain the word "gauge"
  await page.click('.awd-card:has(.awd-card-name:text-is("Gauge"))')
  await page.click('button:has-text("Configure")')
  await page.waitForTimeout(2000)
  await shot('dialog-step2')

  // add it to the grid, then resize it large via the gridstack SE handle
  await page.click('button:has-text("Add to dashboard")')
  await page.waitForTimeout(800)
  const item = page.locator('.grid-stack-item').last()
  await item.scrollIntoViewIfNeeded()
  await item.hover() // gridstack reveals resize handles on hover
  await page.waitForTimeout(300)
  let hb = await item.locator('.ui-resizable-se').boundingBox().catch(() => null)
  if (!hb) {
    // fallback: gridstack's SE handle sits in the bottom-right corner
    const ib = await item.boundingBox()
    if (!ib) throw new Error('added widget not found — is edit mode on?')
    hb = { x: ib.x + ib.width - 12, y: ib.y + ib.height - 12, width: 8, height: 8 }
  }
  const startX = hb.x + hb.width / 2
  const startY = hb.y + hb.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // grow ~3 columns right and ~2 rows down, in steps so gridstack tracks it
  await page.mouse.move(startX + 180, startY + 100, { steps: 12 })
  await page.mouse.move(startX + 360, gaugeTargetY(startY), { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(900)
  await item.scrollIntoViewIfNeeded()
  const box = await item.boundingBox()
  if (box) await page.mouse.move(box.x + box.width / 2, Math.max(box.y - 40, 5)) // pointer off the card (no hover outline)
  await page.waitForTimeout(300)
  await shot('gauge-large')

    // clean up: remove the temp widget, exit edit mode (saves original layout)
    await item.locator('.widget-remove').click()
    await page.waitForTimeout(400)
    await page.click('button:has-text("Done editing")')
    await page.waitForTimeout(900)
    await page.close()
    break main
  } catch (err) {
    await page.close()
    if (attempt >= 3) throw err
    console.log(`pass ${attempt} interrupted (${err.message.split('\n')[0]}) — retrying`)
  }
}

function gaugeTargetY(startY) {
  return startY + 200
}

// ---------- empty-dashboard path: intercept the layout GET ----------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.route('**/api/dashboard/layout', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ widgets: [] }) })
    } else {
      route.continue()
    }
  })
  await login(page)
  await page.waitForSelector('.grid-empty-panel', { timeout: 15000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(OUT, 'empty-dashboard.png') })
  await page.close()
}

console.log('done ->', OUT)
await browser.close()

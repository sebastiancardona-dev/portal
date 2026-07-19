/* Screenshot pass for the accounts manage-user panel (portal v0.4.1).
 * Run from web/: node scripts/shots-manage-user.mjs [outDir]
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] ?? 'shots-manage'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) })

try {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
  await page.click('.auth-sso-cta')
  await page.waitForSelector('input[name="username"]')
  await page.fill('input[name="username"]', 'juanse@local.dev')
  await page.fill('input[name="password"]', 'local-admin-password')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.grid-stack', { timeout: 15000 })

  await page.click('a[href="/accounts"]')
  await page.waitForSelector('.mint-form', { timeout: 10000 })
  await page.waitForTimeout(800)

  // open the manage panel on the first user row
  await page.click('button:has-text("Manage") >> nth=0')
  await page.waitForSelector('.manage-user')
  await page.waitForTimeout(400)
  await shot('01-manage-open')

  // uncheck a group to show the dirty/save state (recruiter or friend)
  const friend = page.locator('.manage-group:has-text("friend") input')
  await friend.click()
  await page.waitForTimeout(300)
  await shot('02-manage-dirty')
  await friend.click() // restore

  // arm the disable two-step if it is clickable (not self)
  const disableBtn = page.locator('button:has-text("Disable account")')
  if (await disableBtn.isEnabled()) {
    await disableBtn.click()
    await page.waitForTimeout(300)
    await shot('03-disable-armed')
    await page.click('button:has-text("Keep active")')
  } else {
    await shot('03-disable-blocked-self')
  }

  // mobile
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(600)
  await shot('04-manage-mobile')

  console.log('done ->', OUT)
} finally {
  await browser.close()
}

// Single dashboard shot against the packaged single-origin rig on :8081.
// SSO: the rig needs PORTAL_OIDC_* env pointing at the local auth service, and
// the `portal` client must have http://localhost:8081/login/oauth2/code/ecosystem
// registered as a redirect URI (see api README).
// Usage: node scripts/final-shot.mjs [outDir]
import { chromium } from 'playwright'

const OUT = process.argv[2] ?? 'shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:8081/login')
await page.click('.auth-sso-cta')
await page.waitForSelector('input[name="username"]')
await page.fill('input[name="username"]', 'juanse@local.dev')
await page.fill('input[name="password"]', 'local-admin-password')
await page.click('button[type="submit"]')
await page.waitForURL('http://localhost:8081/')
await page.waitForTimeout(3500)
await page.screenshot({ path: `${OUT}/final-dashboard.png` })
await browser.close()
console.log('done')

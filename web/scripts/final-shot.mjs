import { chromium } from 'playwright'

const OUT = 'C:/Users/Juanse/AppData/Local/Temp/claude/C--Users-Juanse-wrkspc/ab404def-97ee-4117-80c4-b592995e1f24/scratchpad/shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:8081/login')
await page.fill('input[type="email"], input[name="email"]', 'juanse@local.dev')
await page.fill('input[type="password"]', 'local-admin-password')
await page.click('button.btn-primary')
await page.waitForURL('http://localhost:8081/')
await page.waitForTimeout(3500)
await page.screenshot({ path: `${OUT}/final-dashboard.png` })
await browser.close()
console.log('done')

// iPhone App Store screenshots from the Expo Web export, driven by Playwright.
// Port of e2e/marketing/0{1..4}-*.yaml; iPad stays on the simulator (run.sh),
// because the web build gives a 1032pt viewport the desktop layout.
//   npx expo export --platform web
//   node e2e/marketing/web-capture.mjs [outDir]   (default: the committed iPhone set)
import { spawn } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { chromium } from '@playwright/test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const out = resolve(process.argv[2] ?? `${root}/artifacts/marketing/threadbase-maestro`)
if (!existsSync(`${root}/dist/index.html`)) throw new Error('No dist/ — run `npx expo export --platform web` first')

const ORIGIN = 'http://127.0.0.1:4173'
const KEY = 'mock-key-123'
const SERVERS = [
  ['srv_work', 7071, 'Work Mac'],
  ['srv_home', 7072, 'Home Mac'],
  ['srv_devbox', 7073, 'Linux Devbox'],
]
const PAIRED = [
  {
    name: 'threadbase_servers',
    value: JSON.stringify({
      list: SERVERS.map(([id, port, label]) => ({ id, url: `http://127.0.0.1:${port}`, label })),
      displayedServerIds: SERVERS.map(([id]) => id),
      hasEverHadServer: true,
    }),
  },
  ...SERVERS.map(([id]) => ({ name: `threadbase_api_key_${id}`, value: KEY })),
]
// 1206x2622, the 6.9" App Store size.
const IPHONE = { viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true }

const demo = (port, path, body = {}) =>
  fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  }).then((r) => {
    if (!r.ok) throw new Error(`${path} on :${port} -> ${r.status}`)
  })
const reset = () => Promise.all(SERVERS.map(([, port]) => demo(port, '/__demo__/reset')))

const results = []
let page, dir

// Web keeps stacked screens mounted, so the screen underneath matches too.
const id = (t) => page.getByTestId(t).filter({ visible: true }).first()
const text = (re) => page.getByText(re).filter({ visible: true }).first()
const settle = (ms = 1500) => page.waitForTimeout(ms)
async function shot(name) {
  await settle()
  const path = `${dir}/${name}.png`
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true })
  await page.screenshot({ path })
  results.push(`ok   ${dir.split('/').pop()}/${name}`)
}
const blur = () => page.evaluate(() => document.activeElement?.blur())
// Resume + take-over pushes a second session screen, so pop until the hub shows.
async function backToHub() {
  for (let i = 0; i < 4 && !(await id('hub-screen').isVisible()); i++) {
    await page.getByTestId('screen-header-back-button').filter({ visible: true }).last().click()
    await id('leave-notice-close').click({ timeout: 2000 }).catch(() => {})
    await settle(1000)
  }
  await id('hub-screen').waitFor({ timeout: 10_000 })
}
async function search(query) {
  if (await id('hub-search-input').isVisible()) await id('header-search-btn').click()
  await id('header-search-btn').click()
  await id('hub-search-input').fill(query)
}
async function scrollTo(t) {
  const el = id(t)
  const vp = page.viewportSize()
  for (let i = 0; i < 20 && !(await el.isVisible()); i++) {
    await page.mouse.move(vp.width / 2, vp.height / 2)
    await page.mouse.wheel(0, 400)
    await settle(300)
  }
  await el.scrollIntoViewIfNeeded()
}

const FLOWS = {
  async '01-start-anywhere-continue-anywhere'() {
    await id('session-row-wm-claude-persistence').waitFor({ timeout: 15_000 })
    await shot('01-session-discovered')
    await id('session-row-wm-claude-persistence').click()
    await text(/Session persistence has three parts/).waitFor({ timeout: 10_000 })
    await shot('02-existing-session-opened')
    await id('resume-button').click()
    await id('resume-collision-take-over').click({ timeout: 10_000 })
    await id('session-detail-screen').waitFor({ timeout: 15_000 })
    await demo(7071, '/__demo__/status', {
      sessionId: 'wm-claude-persistence',
      status: 'waiting_input',
      lastOutput: 'Summary ready — waiting for your next prompt',
    })
    await text(/^Needs you$/).waitFor({ timeout: 10_000 })
    await shot('03-waiting-for-input')
    await id('chat-message-input').fill('Now list the two most important files involved in that behavior.')
    await id('chat-send-button').click()
    await text(/Now list the two most important files/).waitFor({ timeout: 10_000 })
    await shot('04-prompt-sent-from-mobile')
    await text(/Read src\/sessions\/rehydrate\.ts/).waitFor({ timeout: 10_000 })
    await blur()
    await shot('05-agent-resumed-remotely')
    await backToHub()
    await text(/Summarize session persistence/).waitFor({ timeout: 10_000 })
    await shot('06-hero')
  },

  async '02-agent-memory'() {
    await scrollTo('conversation-row-conv-ld-onboarding')
    await shot('01-history-across-sessions')
    await search('callback environment')
    await id('conversation-row-conv-wm-auth0').waitFor({ timeout: 10_000 })
    // Absent on web (cause not traced: it backs the live wm-codex-auth session); the other rows span two machines.
    await id('conversation-row-conv-wm-auth-callback').waitFor({ timeout: 3000 }).catch(() => results.push('soft 02/auth-callback row absent'))
    await id('conversation-row-conv-hm-storefront-redirect').waitFor()
    await page.keyboard.press('Enter')
    await shot('02-search-engineering-memory')
    await id('conversation-row-conv-wm-auth0').click()
    await id('search-match-count').waitFor({ timeout: 10_000 })
    await shot('03-recovered-old-solution')
    await id('screen-header-back-button').click()
    await id('hub-search-input').waitFor({ timeout: 10_000 })
    await search('session persistence SQLite resume')
    await id('conversation-row-conv-hm-sqlite').waitFor({ timeout: 10_000 })
    await page.keyboard.press('Enter')
    await shot('04-cross-project-search')
    await search('authentication retry')
    await id('conversation-row-conv-wm-auth-retry').waitFor({ timeout: 10_000 })
    await id('conversation-row-conv-hm-auth-retry').waitFor()
    await page.keyboard.press('Enter')
    await shot('05-cross-provider-memory')
    await search('session')
    await page.keyboard.press('Enter')
    // Backs the live ld session, like auth-callback above: absent on web.
    await id('conversation-row-conv-ld-search').waitFor({ timeout: 3000 }).catch(() => results.push('soft 02/ld-search row absent'))
    await shot('07-hero')
    await id('conversation-row-conv-hm-sqlite').click()
    await id('resume-button').click({ timeout: 10_000 })
    await id('session-detail-screen').waitFor({ timeout: 15_000 })
    await text(/^Needs you$/).waitFor({ timeout: 10_000 })
    await shot('06-history-to-active-session')
  },

  async '03-control-plane'() {
    await text(/Summarize session persistence/).waitFor({ timeout: 15_000 })
    await shot('01-all-machines-all-agents')
    await text(/Fix authentication callback/).click()
    await id('session-detail-screen').waitFor({ timeout: 15_000 })
    await text(/^Needs you$/).waitFor({ timeout: 10_000 })
    await shot('02-waiting-agent-work-mac')
    await id('chat-message-input').fill('Continue with the recommended approach. Do not modify files.')
    await id('chat-send-button').click()
    await text(/Continue with the recommended approach/).waitFor({ timeout: 10_000 })
    await text(/^Working$/).waitFor({ timeout: 10_000 })
    await blur()
    await shot('03-unblocked-remotely')
    await backToHub()
    await text(/Improve session search/).click()
    await id('session-detail-screen').waitFor({ timeout: 15_000 })
    await text(/phrase-match/).waitFor({ timeout: 10_000 })
    await shot('04-switch-machine-session')
    await backToHub()
    await scrollTo('conversation-row-conv-hm-onboarding')
    await id('conversation-row-conv-hm-onboarding').click()
    await text(/Three suggestions/).waitFor({ timeout: 15_000 })
    await shot('05-completed-session-other-machine')
    await id('screen-header-back-button').click()
    await id('hub-screen').waitFor({ timeout: 10_000 })
    await search('onboarding')
    await id('conversation-row-conv-ld-onboarding').waitFor({ timeout: 10_000 })
    await id('conversation-row-conv-hm-onboarding').waitFor()
    await page.keyboard.press('Enter')
    await shot('06-search-across-machines')
    await id('header-search-btn').click()
    await id('layout-projects').click()
    await text(/LINUX DEVBOX/i).waitFor({ timeout: 10_000 })
    await shot('07-hero')
  },

  async '04-onboarding'() {
    await id('onboarding-language-cta').waitFor({ timeout: 15_000 })
    await shot('01-language')
    await id('onboarding-language-cta').click()
    await id('onboarding-welcome-cta').waitFor({ timeout: 8000 })
    await shot('02-welcome')
    await id('onboarding-welcome-cta').click()
    await id('onboarding-connect-paste-card').waitFor({ timeout: 8000 })
    await shot('03-connect')
    await id('onboarding-connect-paste-card').click()
    await id('onboarding-connect-url-input').fill('http://127.0.0.1:7071')
    await id('server-form-toggle-api-key').click().catch(() => {})
    await id('onboarding-connect-token-input').fill(KEY)
    await blur()
    await shot('04-connect-details')
    await id('onboarding-connect-handshake-cta').click()
    await id('pair-confirm-add-btn').waitFor({ timeout: 15_000 })
    await shot('05-confirm-key')
    await id('pair-confirm-add-btn').click()
    await id('onboarding-notifications-cta').waitFor({ timeout: 15_000 })
    await shot('06-notifications')
    await id('onboarding-notifications-cta').click()
    await id('onboarding-done-cta').waitFor({ timeout: 8000 })
    await shot('07-done')
    await id('onboarding-done-cta').click()
    await id('session-row-wm-claude-persistence').waitFor({ timeout: 15_000 })
    await shot('08-hub')
  },
}

const procs = [
  spawn('node', ['e2e/marketing/demo-streamer.js'], { cwd: root, stdio: 'ignore' }),
  spawn('npx', ['expo', 'serve', 'dist', '--port', '4173'], { cwd: root, stdio: 'ignore' }),
]
const up = (url) => fetch(url).then(() => true, () => false)
for (let i = 0; i < 60 && !((await up(ORIGIN)) && (await up('http://127.0.0.1:7073'))); i++) {
  await new Promise((r) => setTimeout(r, 1000))
}

const browser = await chromium.launch()
try {
  for (const [flow, run] of Object.entries(FLOWS)) {
    await reset()
    if (flow === '03-control-plane') await demo(7071, '/api/sessions/wm-claude-persistence/adopt')
    const ctx = await browser.newContext({
      ...IPHONE,
      hasTouch: true,
      colorScheme: 'dark',
      locale: 'en-US',
      storageState: { cookies: [], origins: flow === '04-onboarding' ? [] : [{ origin: ORIGIN, localStorage: PAIRED }] },
    })
    page = await ctx.newPage()
    page.on('pageerror', (e) => results.push(`err  ${flow}: ${e.message}`))
    dir = `${out}/${flow}`
    await page.goto(ORIGIN)
    // The splash overlay fades out several seconds after the first screen mounts.
    await settle(8000)
    try {
      await run()
    } catch (e) {
      mkdirSync(out, { recursive: true })
      await page.screenshot({ path: `${dir}-FAILED.png` }).catch(() => {})
      results.push(`FAIL ${flow}: ${e.message.split('\n')[0]}`)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  procs.forEach((p) => p.kill())
}
console.log(results.join('\n'))
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0

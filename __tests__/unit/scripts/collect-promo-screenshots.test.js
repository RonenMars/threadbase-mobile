/**
 * @jest-environment node
 *
 * The promo capture scripts rename Maestro takeScreenshot stems into the six
 * store-ready files. If a yaml stem changes and collect.sh is not updated,
 * a green Maestro run still produces an empty deliverable folder.
 */

'use strict'

const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../..')
const COLLECT = path.join(ROOT, 'e2e/collect-promo-screenshots.sh')
const PACKAGE_JSON = path.join(ROOT, 'package.json')

const SHOTS = [
  ['card-start-or-take-over', '01-start-session.png'],
  ['_raw-take-over-banner', '02-take-over-session.png'],
  ['card-search', '03-search-results.png'],
  ['hero-approval-card', '04-approval-request.png'],
  ['card-approve', '05-approval-response.png'],
  ['card-multi-machine', '06-multi-machine-projects.png'],
]

function yamlScreenshotStems() {
  const e2eDir = path.join(ROOT, 'e2e')
  const stems = []
  for (const name of fs.readdirSync(e2eDir)) {
    if (!name.startsWith('promo_screenshots_') || !name.endsWith('.yaml')) continue
    const text = fs.readFileSync(path.join(e2eDir, name), 'utf8')
    for (const match of text.matchAll(/takeScreenshot:\s+(\S+)/g)) {
      stems.push(path.basename(match[1]))
    }
  }
  return stems
}

describe('collect-promo-screenshots.sh', () => {
  it('is wired from package.json and covers every promo takeScreenshot stem', () => {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'))
    expect(pkg.scripts['test:e2e:promo:screenshots:ios']).toBe('./e2e/run-promo-screenshots-ios.sh')
    expect(pkg.scripts['test:e2e:promo:screenshots:android']).toBe(
      './e2e/run-promo-screenshots-android.sh',
    )

    const collect = fs.readFileSync(COLLECT, 'utf8')
    const stems = yamlScreenshotStems()
    const setup = fs.readFileSync(path.join(ROOT, 'e2e/promo-setup.yaml'), 'utf8')
    expect(setup).toContain('clearKeychain: true')
    const e2eDir = path.join(ROOT, 'e2e')
    for (const name of fs.readdirSync(e2eDir)) {
      if (!name.startsWith('promo_screenshots_') || !name.endsWith('.yaml')) continue
      expect(fs.readFileSync(path.join(e2eDir, name), 'utf8')).toContain(
        'runFlow: promo-setup.yaml',
      )
    }
    expect(stems).toHaveLength(SHOTS.length)
    for (const [stem, dest] of SHOTS) {
      expect(stems).toContain(stem)
      expect(collect).toContain(`copy_shot "${stem}" "${dest}"`)
    }
  })

  it('copies the newest matching stem into the store-ready name', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-shots-'))
    const dest = path.join(dir, 'out')
    const older = path.join(dir, 'search', 'old')
    const newer = path.join(dir, 'search', 'new', 'takeScreenshot')
    fs.mkdirSync(older, { recursive: true })
    fs.mkdirSync(newer, { recursive: true })

    for (const [stem] of SHOTS) {
      fs.writeFileSync(path.join(older, `${stem}.png`), `old-${stem}`)
      fs.writeFileSync(path.join(newer, `${stem}.png`), `new-${stem}`)
    }
    const oldTime = new Date('2026-01-01T00:00:00Z')
    const newTime = new Date('2026-09-16T00:00:00Z')
    for (const [stem] of SHOTS) {
      fs.utimesSync(path.join(older, `${stem}.png`), oldTime, oldTime)
      fs.utimesSync(path.join(newer, `${stem}.png`), newTime, newTime)
    }

    const result = spawnSync('bash', [COLLECT, 'ios', dest], {
      encoding: 'utf8',
      env: { ...process.env, PROMO_SCREENSHOT_SEARCH_ROOT: path.join(dir, 'search') },
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    for (const [stem, destName] of SHOTS) {
      expect(fs.readFileSync(path.join(dest, destName), 'utf8')).toBe(`new-${stem}`)
    }

    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('fails when a required stem is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-shots-missing-'))
    const dest = path.join(dir, 'out')
    fs.mkdirSync(path.join(dir, 'search'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'search', 'card-search.png'), 'only-one')

    const result = spawnSync('bash', [COLLECT, 'ios', dest], {
      encoding: 'utf8',
      env: { ...process.env, PROMO_SCREENSHOT_SEARCH_ROOT: path.join(dir, 'search') },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/no card-start-or-take-over\.png/)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

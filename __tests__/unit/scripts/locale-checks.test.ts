/**
 * @jest-environment node
 *
 * Tests for scripts/check-locale-freshness.js and
 * scripts/check-locale-untranslated.js against throwaway fixture locale
 * dirs — never the real locales/, so these stay green regardless of the
 * real data's translation state.
 */

import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const ROOT = path.resolve(__dirname, '../../..')
const FRESHNESS_SCRIPT = path.join(ROOT, 'scripts/check-locale-freshness.js')
const UNTRANSLATED_SCRIPT = path.join(ROOT, 'scripts/check-locale-untranslated.js')

type Namespace = Record<string, unknown>
type FixtureTree = Record<string, Record<string, Namespace>> // { 'ns.json': { locale: { key: value } } }

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locale-checks-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function writeFixture(tree: FixtureTree): void {
  for (const [nsFile, byLocale] of Object.entries(tree)) {
    for (const [locale, data] of Object.entries(byLocale)) {
      const localeDir = path.join(dir, locale)
      fs.mkdirSync(localeDir, { recursive: true })
      fs.writeFileSync(path.join(localeDir, nsFile), JSON.stringify(data, null, 2))
    }
  }
}

function writeAllowlist(entries: Record<string, string>): void {
  fs.writeFileSync(path.join(dir, '.identical-ok.json'), JSON.stringify(entries, null, 2))
}

function run(script: string, args: string[] = []) {
  return spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, LOCALE_CHECK_DIR: dir },
  })
}

describe('check-locale-freshness', () => {
  it('passes when recorded hashes match the current English values', () => {
    writeFixture({ 'test.json': { en: { greeting: 'Hello world' } } })

    const bless = run(FRESHNESS_SCRIPT, ['--bless'])
    expect(bless.status).toBe(0)

    const check = run(FRESHNESS_SCRIPT)
    expect(check.status).toBe(0)
  })

  it('fails when an English value changed since the last bless', () => {
    writeFixture({ 'test.json': { en: { greeting: 'Hello world' } } })
    expect(run(FRESHNESS_SCRIPT, ['--bless']).status).toBe(0)

    writeFixture({ 'test.json': { en: { greeting: 'Hello there, world' } } })
    const check = run(FRESHNESS_SCRIPT)

    expect(check.status).toBe(1)
    expect(check.stderr).toContain('test.json:greeting')
  })
})

describe('check-locale-untranslated', () => {
  it('fails on a locale value identical to English that reads as prose', () => {
    writeFixture({
      'test.json': {
        en: { msg: 'This is a real sentence here' },
        xx: { msg: 'This is a real sentence here' },
      },
    })

    const result = run(UNTRANSLATED_SCRIPT)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('xx/test.json:msg')
  })

  it('passes when the identical key is allowlisted', () => {
    writeFixture({
      'test.json': {
        en: { msg: 'This is a real sentence here' },
        xx: { msg: 'This is a real sentence here' },
      },
    })
    writeAllowlist({ 'test.json:msg': 'legitimately identical for this fixture' })

    const result = run(UNTRANSLATED_SCRIPT)
    expect(result.status).toBe(0)
  })

  it('fails for a two-word identical value', () => {
    writeFixture({
      'test.json': {
        en: { title: 'Hello world' },
        xx: { title: 'Hello world' },
      },
    })

    const result = run(UNTRANSLATED_SCRIPT)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('xx/test.json:title')
  })

  it('fails for a single-word identical value', () => {
    writeFixture({
      'test.json': {
        en: { action: 'Export' },
        xx: { action: 'Export' },
      },
    })

    const result = run(UNTRANSLATED_SCRIPT)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('xx/test.json:action')
  })

  it('passes for an interpolation-only identical value', () => {
    writeFixture({
      'test.json': {
        en: { slot: '{{value}}' },
        xx: { slot: '{{value}}' },
      },
    })

    const result = run(UNTRANSLATED_SCRIPT)
    expect(result.status).toBe(0)
  })
})

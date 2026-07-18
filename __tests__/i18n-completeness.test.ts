import fs from 'fs'
import path from 'path'

// Key-parity gate for every locale against English, in both directions:
// - missing: an English key with no counterpart in the locale (untranslated UI)
// - stale: a locale key with no counterpart in English (rotting leftovers)
// Plural forms are compared by base key: i18next locales legitimately carry
// different CLDR plural suffixes (en: _one/_other; ru adds _few/_many; ar adds
// _zero/_two/_few/_many), so `key_few` in Russian matches `key_one` in English.

const LOCALES_DIR = path.join(__dirname, '..', 'locales')
const REFERENCE = 'en'

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return typeof v === 'object' && v !== null
      ? flattenKeys(v as Record<string, unknown>, key)
      : [key]
  })
}

/** Collapse plural variants to their base key so CLDR differences don't count. */
function normalize(keys: string[]): Set<string> {
  return new Set(keys.map((k) => k.replace(PLURAL_SUFFIX, '')))
}

function readNamespace(locale: string, nsFile: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, locale, nsFile), 'utf8')
  return JSON.parse(raw) as Record<string, unknown>
}

const namespaceFiles = fs
  .readdirSync(path.join(LOCALES_DIR, REFERENCE))
  .filter((f) => f.endsWith('.json'))
  .sort()

const locales = fs
  .readdirSync(LOCALES_DIR)
  .filter((d) => d !== REFERENCE && fs.statSync(path.join(LOCALES_DIR, d)).isDirectory())
  .sort()

describe('i18n key completeness', () => {
  it('discovers locales and namespaces', () => {
    expect(locales.length).toBeGreaterThan(0)
    expect(namespaceFiles.length).toBeGreaterThan(0)
  })

  describe.each(locales)('%s', (locale) => {
    it.each(namespaceFiles)('%s has every English key and nothing stale', (nsFile) => {
      expect(fs.existsSync(path.join(LOCALES_DIR, locale, nsFile))).toBe(true)

      const enKeys = normalize(flattenKeys(readNamespace(REFERENCE, nsFile)))
      const locKeys = normalize(flattenKeys(readNamespace(locale, nsFile)))

      const missing = [...enKeys].filter((k) => !locKeys.has(k)).sort()
      const stale = [...locKeys].filter((k) => !enKeys.has(k)).sort()

      expect(missing).toEqual([])
      expect(stale).toEqual([])
    })
  })
})

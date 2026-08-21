import fs from 'fs'
import path from 'path'

// Key-parity gate for every locale against English, in both directions:
// - missing: an English key with no counterpart in the locale (untranslated UI)
// - stale: a locale key with no counterpart in English (rotting leftovers)
// Plural forms are compared by base key: i18next locales legitimately carry
// different CLDR plural suffixes, so `key_few` in Russian matches `key_one` in
// English. Each locale's actual runtime CLDR variants are validated separately.

const LOCALES_DIR = path.join(__dirname, '..', 'locales')
const REFERENCE = 'en'
const EXPECTED_LOCALES = ['ar', 'en', 'he', 'ru']

const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const
type PluralSuffix = (typeof PLURAL_SUFFIXES)[number]

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function expectedPluralSuffixes(locale: string): PluralSuffix[] {
  const categories = new Set(
    new Intl.PluralRules(locale).resolvedOptions().pluralCategories,
  )
  return PLURAL_SUFFIXES.filter((suffix) => categories.has(suffix))
}

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

function pluralVariantErrors(
  referenceKeys: string[],
  localeKeys: string[],
  expectedSuffixes: readonly PluralSuffix[],
): string[] {
  const pluralBases = new Set(
    [...referenceKeys, ...localeKeys].flatMap((key) => {
      const match = key.match(PLURAL_SUFFIX)
      return match ? [key.slice(0, -match[0].length)] : []
    }),
  )
  const groups = new Map<string, Set<PluralSuffix>>()

  for (const base of pluralBases) groups.set(base, new Set<PluralSuffix>())

  for (const key of localeKeys) {
    const match = key.match(PLURAL_SUFFIX)
    if (!match) continue

    const base = key.slice(0, -match[0].length)
    const variants = groups.get(base) ?? new Set<PluralSuffix>()
    variants.add(match[1] as PluralSuffix)
    groups.set(base, variants)
  }

  return [...groups.entries()].flatMap(([base, variants]) => {
    const actualSuffixes = PLURAL_SUFFIXES.filter((suffix) => variants.has(suffix))
    return actualSuffixes.length === expectedSuffixes.length &&
      actualSuffixes.every((suffix, index) => suffix === expectedSuffixes[index])
      ? []
      : [
          `${base}: expected [${expectedSuffixes.join(', ')}], got [${actualSuffixes.join(', ')}]`,
        ]
  })
}

function readNamespace(locale: string, nsFile: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, locale, nsFile), 'utf8')
  return JSON.parse(raw) as Record<string, unknown>
}

function namespaceFilesFor(locale: string): string[] {
  return fs
    .readdirSync(path.join(LOCALES_DIR, locale))
    .filter((f) => f.endsWith('.json'))
    .sort()
}

const namespaceFiles = namespaceFilesFor(REFERENCE)

const locales = fs
  .readdirSync(LOCALES_DIR)
  .filter((d) => fs.statSync(path.join(LOCALES_DIR, d)).isDirectory())
  .sort()

describe('i18n key completeness', () => {
  it('detects an incomplete Arabic plural group', () => {
    const incompleteArabicGroup = [
      'item_zero',
      'item_one',
      'item_two',
      'item_few',
      'item_other',
    ]

    expect(pluralVariantErrors(['item_one', 'item_other'], incompleteArabicGroup, expectedPluralSuffixes('ar'))).toEqual([
      'item: expected [zero, one, two, few, many, other], got [zero, one, two, few, other]',
    ])
  })

  it('detects an incomplete Hebrew plural group', () => {
    expect(pluralVariantErrors(['item_one', 'item_other'], ['item_one', 'item_other'], expectedPluralSuffixes('he'))).toEqual([
      'item: expected [one, two, other], got [one, other]',
    ])
  })

  it('rejects replacing a plural group with an unsuffixed locale key', () => {
    expect(
      pluralVariantErrors(
        ['item_one', 'item_other'],
        ['item'],
        expectedPluralSuffixes('ru'),
      ),
    ).toEqual([
      'item: expected [one, few, many, other], got []',
    ])
  })

  it('has exactly the supported locale directories', () => {
    expect(locales).toEqual(EXPECTED_LOCALES)
  })

  it('discovers English namespaces', () => {
    expect(namespaceFiles.length).toBeGreaterThan(0)
  })

  describe.each(locales)('%s', (locale) => {
    it('has exactly the English namespace files', () => {
      expect(namespaceFilesFor(locale)).toEqual(namespaceFiles)
    })

    it.each(namespaceFiles)('%s has every English key and nothing stale', (nsFile) => {
      const enKeys = normalize(flattenKeys(readNamespace(REFERENCE, nsFile)))
      const locKeys = normalize(flattenKeys(readNamespace(locale, nsFile)))

      const missing = [...enKeys].filter((k) => !locKeys.has(k)).sort()
      const stale = [...locKeys].filter((k) => !enKeys.has(k)).sort()

      expect(missing).toEqual([])
      expect(stale).toEqual([])
    })

    it.each(namespaceFiles)('%s has complete locale-specific plural groups', (nsFile) => {
      const referenceKeys = flattenKeys(readNamespace(REFERENCE, nsFile))
      const localeKeys = flattenKeys(readNamespace(locale, nsFile))
      expect(pluralVariantErrors(referenceKeys, localeKeys, expectedPluralSuffixes(locale))).toEqual([])
    })
  })
})

import fs from 'fs'
import path from 'path'

// Dead-key gate: every English key must be referenced somewhere in the source.
// Keys are read both as `t('ns:key')` and bare `t('key')` under a per-file
// namespace, so matching is on the key path alone — namespace-agnostic.
// Dynamic keys (`t(`scanner.errors.uri.${code}`)`) can't be resolved statically;
// the literal part before the first `${` is kept as a prefix that covers them.
// Keys hoisted into a const array and fed to t() later are counted too, via a
// pass over every quoted string literal in the source.

const ROOT = path.join(__dirname, '..')
const LOCALES_DIR = path.join(ROOT, 'locales')
const REFERENCE = 'en'
const SOURCE_DIRS = ['app', 'components', 'hooks', 'lib', 'services', 'utils', 'contexts', 'stores']
const SOURCE_EXT = /\.(ts|tsx)$/
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

// t('a.b'), t("a.b"), i18n.t('ns:a.b') — captures the quoted first argument.
const T_LITERAL = /\bt\(\s*['"]([^'"]+)['"]/g
// t(`a.b.${x}`) — captures the static prefix up to the first interpolation.
const T_TEMPLATE = /\bt\(\s*`([^`$]*)\$\{/g
// Any quoted dotted string — catches keys stored in consts before reaching t().
const DOTTED_LITERAL = /['"]([A-Za-z][\w-]*(?:\.[\w-]+)+)['"]/g

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(full)
    return SOURCE_EXT.test(e.name) && !e.name.endsWith('.d.ts') ? [full] : []
  })
}

// Arrays are leaves: they're fetched whole via t(key, { returnObjects: true }),
// so the key is the array itself, not its indices.
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? flattenKeys(v as Record<string, unknown>, key)
      : [key]
  })
}

function collectReferences(): { exact: Set<string>; prefixes: string[] } {
  const exact = new Set<string>()
  const prefixes: string[] = []

  for (const dir of SOURCE_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const src = fs.readFileSync(file, 'utf8')
      for (const [, raw] of src.matchAll(T_LITERAL)) {
        exact.add(raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw)
      }
      for (const [, raw] of src.matchAll(T_TEMPLATE)) {
        const stripped = raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw
        if (stripped) prefixes.push(stripped)
      }
      for (const [, raw] of src.matchAll(DOTTED_LITERAL)) {
        exact.add(raw.includes(':') ? raw.slice(raw.indexOf(':') + 1) : raw)
      }
    }
  }
  return { exact, prefixes }
}

const namespaceFiles = fs
  .readdirSync(path.join(LOCALES_DIR, REFERENCE))
  .filter((f) => f.endsWith('.json'))
  .sort()

const { exact, prefixes } = collectReferences()

function isUsed(key: string): boolean {
  const base = key.replace(PLURAL_SUFFIX, '')
  return exact.has(key) || exact.has(base) || prefixes.some((p) => base.startsWith(p))
}

describe('i18n unused keys', () => {
  it('finds t() references in the source tree', () => {
    expect(exact.size).toBeGreaterThan(0)
  })

  it.each(namespaceFiles)('%s has no unused keys', (nsFile) => {
    const raw = fs.readFileSync(path.join(LOCALES_DIR, REFERENCE, nsFile), 'utf8')
    const keys = flattenKeys(JSON.parse(raw) as Record<string, unknown>)
    expect(keys.filter((k) => !isUsed(k)).sort()).toEqual([])
  })
})

// Regression test for the i18next/no-literal-string rule config in eslint.config.js.
// The plugin is on v6.1.5, whose option schema (mode/jsx-attributes/callees/
// object-properties/words) is unrelated to the v5 names (markupOnly/attributes/
// ignoreAttribute/ignoreCallee) — v6 has no additionalProperties:false, so v5
// keys are silently accepted and do nothing.
//
// This shells out to the real `eslint` binary against the real eslint.config.js
// rather than driving the ESLint class in-process. eslint-plugin-i18next builds
// its rules map at require-time via the `requireindex` package, which filters
// directory entries through `require.extensions` — a real property on Node's
// Module system that Jest's sandboxed `require` never populates. Under Jest,
// requiring the plugin in-process silently resolves to zero rules, so a test
// that drove ESLint that way would stay green even if plugin resolution broke
// for real. The subprocess uses Node's own `require`, so it exercises the
// genuine resolution path — this test fails if that path breaks.
import { execFileSync } from 'child_process'
import path from 'path'

const RULE = 'i18next/no-literal-string'
const repoRoot = path.resolve(__dirname, '../../..')
const eslintBin = path.join(repoRoot, 'node_modules/.bin/eslint')

interface EslintMessage {
  ruleId: string | null
}
interface EslintResult {
  messages: EslintMessage[]
}

function lint(code: string, filePath: string): EslintResult[] {
  try {
    const out = execFileSync(
      eslintBin,
      ['--no-config-lookup', '-c', 'eslint.config.js', '--stdin', '--stdin-filename', filePath, '-f', 'json'],
      { cwd: repoRoot, input: code, encoding: 'utf8' },
    )
    return JSON.parse(out) as EslintResult[]
  } catch (error) {
    // eslint exits 1 when it finds lint problems; stdout still carries the JSON report.
    const out = (error as { stdout?: string }).stdout
    if (typeof out === 'string' && out.length > 0) return JSON.parse(out) as EslintResult[]
    throw error
  }
}

function fires(code: string, filePath = 'components/LintFixture.tsx') {
  const [result] = lint(code, filePath)
  return result.messages.some((m) => m.ruleId === RULE)
}

describe('i18next/no-literal-string config', () => {
  it('fires on an Alert.alert call with literal strings', () => {
    const code = `
      import { Alert } from 'react-native'
      Alert.alert('Discard changes?', 'Your unsaved changes will be lost.')
    `
    expect(fires(code)).toBe(true)
  })

  it('fires on a whitelisted object property', () => {
    const code = `const opts = { text: 'Keep Editing' }`
    expect(fires(code)).toBe(true)
  })

  it('fires on accessibilityLabel', () => {
    const code = `const el = <View accessibilityLabel="Close the dialog" />`
    expect(fires(code)).toBe(true)
  })

  it('fires on placeholder', () => {
    const code = `const el = <TextInput placeholder="Type your message" />`
    expect(fires(code)).toBe(true)
  })

  it('fires on raw JSX text', () => {
    const code = `const el = <Text>Raw literal</Text>`
    expect(fires(code)).toBe(true)
  })

  it('stays silent on testID', () => {
    const code = `const el = <View testID="composer-input" />`
    expect(fires(code)).toBe(false)
  })

  it('stays silent on a hex colour literal', () => {
    const code = `const bg = '#0a1424'`
    expect(fires(code)).toBe(false)
  })

  it('stays silent on an i18n key path', () => {
    const code = `const key = 'hostPressure.banner.memoryCritical'`
    expect(fires(code)).toBe(false)
  })

  it('stays silent on a SCREAMING_CASE constant', () => {
    const code = `const flag = 'SOME_CONSTANT'`
    expect(fires(code)).toBe(false)
  })

  it('stays silent on a single lowercase token', () => {
    const code = `const dir = 'rtl'`
    expect(fires(code)).toBe(false)
  })

  it('stays silent on the use-strict directive prologue', () => {
    const code = `'use strict';\nconst dir = 'rtl'`
    expect(fires(code, 'scripts/lint-fixture.js')).toBe(false)
  })

  // `callees: { include: [...] }` means "check ONLY these calls" — the plugin
  // skips the whole subtree of every other call, so a literal nested in any
  // callback goes unreported. These four pin that the config uses `exclude`.
  it('fires on a literal inside a callback argument', () => {
    const code = `
      import { Alert } from 'react-native'
      onRetry(() => { Alert.alert('Restart failed', 'The session did not come back.') })
    `
    expect(fires(code)).toBe(true)
  })

  it('fires on a literal inside useMemo', () => {
    const code = `const spec = useMemo(() => ({ label: 'Save changes now' }), [])`
    expect(fires(code)).toBe(true)
  })

  it('fires on a literal inside .map', () => {
    const code = `const rows = items.map(() => ({ text: 'Cancel Session' }))`
    expect(fires(code)).toBe(true)
  })

  it('fires on a literal inside setTimeout', () => {
    const code = `
      import { Alert } from 'react-native'
      setTimeout(() => { Alert.alert('Error', 'Something went wrong') }, 10)
    `
    expect(fires(code)).toBe(true)
  })

  it('stays silent on a clientLog message', () => {
    const code = `clientLog.info('browse', 'start session pressed', { serverId })`
    expect(fires(code)).toBe(false)
  })

  it('stays silent on a console call', () => {
    const code = `console.log('[sentry] consent sync fired, enabled =', enabled)`
    expect(fires(code)).toBe(false)
  })

  it('stays silent on an Error message', () => {
    const code = `throw new Error('Server returned an unrecognized backup payload')`
    expect(fires(code)).toBe(false)
  })

  it('stays silent on a colon-namespaced wire discriminant', () => {
    const code = `goReady(id, 'session_update:ptyAttached')`
    expect(fires(code)).toBe(false)
  })

  it('stays silent on an ANSI escape sequence', () => {
    const code = `const key = delta > 0 ? '\\x1b[B' : '\\x1b[A'`
    expect(fires(code)).toBe(false)
  })
})

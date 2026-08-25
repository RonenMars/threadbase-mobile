#!/usr/bin/env node
'use strict'
// run-i18n-checks.js — chains the locale-quality scripts ahead of the i18n
// jest suite so `npm run test:i18n` fails when any one of them fails. A
// cross-platform npm script (this repo also runs on Windows cmd.exe, which
// has no `&&`/`||`) can't express that chain directly, so this Node runner
// replaces it. Runs node scripts by absolute path (not through
// node_modules/.bin) and jest via its committed bin file, so nothing here
// depends on shell binary resolution.

const { execFileSync, spawnSync } = require('child_process')
const path = require('path')

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const JEST_BIN = path.join(ROOT, 'node_modules/jest/bin/jest.js')
const I18NEXT_CLI_BIN = path.join(ROOT, 'node_modules/i18next-cli/dist/cjs/cli.js')

const steps = [
  [process.execPath, [I18NEXT_CLI_BIN, 'status']],
  [process.execPath, [I18NEXT_CLI_BIN, 'status', '--unused']],
  [process.execPath, [path.join(ROOT, 'scripts/check-locale-freshness.js')]],
  [process.execPath, [path.join(ROOT, 'scripts/check-locale-untranslated.js')]],
  [process.execPath, [path.join(ROOT, 'scripts/check-native-strings.js')]],
  [process.execPath, [JEST_BIN, '--ci', '--forceExit', '--testPathPattern=__tests__/i18n']],
]

for (const [command, args] of steps) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: ROOT })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

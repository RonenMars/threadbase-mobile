#!/usr/bin/env node
'use strict'
// check-native-deps.js — fail when two versions of one native module are installed.
//
// A native build can only contain one version of a given native module. When npm
// nests a second copy (a transitive dep wanting a newer version than the root
// pin), the pods still compile, but the binaries end up built against mismatched
// Swift signatures and dyld aborts at launch with "Symbol not found". TestFlight
// build 173 shipped exactly that way and crashed on every launch.
//
// `expo-doctor` detects this, but it exits non-zero for unrelated reasons too
// (patch drift, CNG config fields), so it can't gate CI directly. Run it and key
// on just the duplicate-native-module check.

const { execFileSync } = require('child_process')

let output
try {
  output = execFileSync('npx', ['expo-doctor', '--verbose'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (err) {
  // expo-doctor exits non-zero whenever any check fails; we only care about one,
  // so read its output rather than trusting the exit code.
  output = `${err.stdout || ''}${err.stderr || ''}`
}

if (!output.trim()) {
  console.error('check-native-deps: expo-doctor produced no output')
  process.exit(1)
}

if (!/Check that no duplicate dependencies are installed/.test(output)) {
  console.error('check-native-deps: could not find the duplicate-dependency check in expo-doctor output.')
  console.error('expo-doctor may have renamed it — update this script.')
  process.exit(1)
}

const failed = /✖ Check that no duplicate dependencies are installed/.test(output)

if (!failed) {
  console.log('✓ no duplicate native modules')
  process.exit(0)
}

// expo-doctor prints the check name twice: once in the pass/fail list, then
// again heading the detail block. The details ("Found duplicates for X: …")
// follow the last occurrence and run until the next check's ✖/✔ heading.
const sections = output.split(/✖ Check that no duplicate dependencies are installed/)
const detail = sections[sections.length - 1] || ''
const report = detail.split(/\n(?=[✖✔])/)[0].trim()

console.error('✗ duplicate native modules installed\n')
console.error(report || detail.trim())
console.error('\nA native build may contain only one version of any native module; two copies')
console.error('link against mismatched signatures and crash at launch in dyld.')
console.error('Fix by aligning the root pin in package.json with what the transitive')
console.error('dependency requires (npx expo install --check), then reinstall.')
process.exit(1)

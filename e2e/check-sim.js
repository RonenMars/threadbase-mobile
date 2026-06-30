#!/usr/bin/env node
'use strict'
// Pre-flight for the Maestro E2E scripts: confirm a booted iOS simulator and
// that its runtime is one Maestro 2.0.10 can actually drive.
//
// Maestro 2.0.10's bundled XCUITest driver races/dies during the
// `simctl uninstall/install` that `launchApp: clearState: true` performs on
// iOS 26.x simulators (Xcode 26), failing flows with
// `Unable to clear state … Failed to connect to /127.0.0.1:7001`. iOS ≤ 18
// runtimes are unaffected. So we gate on the booted runtime's major version
// and steer users onto a supported sim. Set E2E_ALLOW_UNSUPPORTED_IOS=1 to
// bypass (e.g. to reproduce the bug, or once a newer Maestro fixes it).
const { execFileSync } = require('child_process')

// Highest iOS major Maestro 2.0.10 drives reliably here. Bump when the pinned
// Maestro version gains iOS 26 support.
const MAX_SUPPORTED_IOS_MAJOR = 18

function runtimeMajor(runtimeId) {
  // e.g. "com.apple.CoreSimulator.SimRuntime.iOS-26-5" -> 26
  const m = runtimeId.match(/SimRuntime\.iOS-(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

const devices = JSON.parse(
  execFileSync('xcrun', ['simctl', 'list', 'devices', '--json']).toString(),
)

const booted = []
for (const [runtimeId, list] of Object.entries(devices.devices)) {
  for (const sim of list) {
    if (sim.state === 'Booted') {
      booted.push({ name: sim.name, udid: sim.udid, major: runtimeMajor(runtimeId), runtimeId })
    }
  }
}

if (booted.length === 0) {
  console.error('Error: No booted iOS simulator found.\nFix: open -a Simulator, then wait for it to boot.')
  process.exit(1)
}

const allowUnsupported = process.env.E2E_ALLOW_UNSUPPORTED_IOS === '1'
const supported = booted.filter((b) => b.major !== null && b.major <= MAX_SUPPORTED_IOS_MAJOR)
const unsupported = booted.filter((b) => b.major === null || b.major > MAX_SUPPORTED_IOS_MAJOR)

for (const b of booted) {
  console.log(`Booted simulator: ${b.name} (iOS ${b.major ?? '?'})`)
}

if (supported.length === 0 && !allowUnsupported) {
  const major = unsupported[0].major ?? '?'
  const offending = unsupported.map((b) => `${b.name} (iOS ${b.major ?? '?'})`).join(', ')
  console.error(
    [
      '',
      `Error: the booted simulator runs iOS ${major}, which Maestro 2.0.10 cannot drive`,
      'reliably — clearState kills the XCUITest driver (see E2E-TESTS-FAILURE-REPORT.md).',
      `Booted: ${offending}`,
      '',
      `Fix: boot a simulator on iOS ${MAX_SUPPORTED_IOS_MAJOR} or older, e.g.`,
      '  xcrun simctl list devices | grep -i "iOS 17"   # find one',
      '  xcrun simctl boot "<device UDID>"',
      'Then install the app on it and re-run.',
      '',
      'Override (will likely fail): E2E_ALLOW_UNSUPPORTED_IOS=1 npm run test:e2e:mock',
    ].join('\n'),
  )
  process.exit(1)
}

if (unsupported.length > 0 && allowUnsupported) {
  console.warn(
    `Warning: running on iOS ${unsupported[0].major ?? '?'} with E2E_ALLOW_UNSUPPORTED_IOS=1 — ` +
      'clearState flows may fail (Maestro 2.0.10 + iOS 26 driver bug).',
  )
}

console.log('iOS simulator is running.')

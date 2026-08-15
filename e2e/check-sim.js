#!/usr/bin/env node
'use strict'
// Pre-flight for the Maestro E2E scripts: confirm a booted iOS simulator and
// that its runtime is one the locally supported Maestro setup can drive.
//
// Maestro 2.0.10's bundled XCUITest driver raced/died during the
// `simctl uninstall/install` that `launchApp: clearState: true` performs on
// iOS 26.x simulators (Xcode 26), failing flows with
// `Unable to clear state … Failed to connect to /127.0.0.1:7001`. Maestro 2.6.1
// fixes that operation — `launchApp: clearState: true` verified COMPLETED on an
// iPhone 17 / iOS 26.4 sim — so the gate allows iOS 26. That result does not
// prove XCTest teardown stayed healthy; e2e/run-maestro.js separately detects
// the known XCTAutomationSupport teardown crash. Set E2E_ALLOW_UNSUPPORTED_IOS=1
// to bypass for any runtime above the compatibility ceiling below.
const { execFileSync } = require('child_process')

const E2E_PLATFORM = process.env.E2E_PLATFORM || 'ios'
const ANDROID_API_LEVEL = process.env.E2E_ANDROID_API_LEVEL || '35'
// Single source of truth with .github/workflows/e2e.yml, which installs exactly
// this version. Nothing pins the local CLI — `npm ci` cannot install a JVM binary
// and the npm packages named `maestro` are unrelated projects — so without this
// gate a local run drives the same flows with whatever Homebrew last gave you.
const { version: PINNED_MAESTRO } = require('./maestro-version.json')

function parseVersion(text) {
  const m = text.match(/(\d+)\.(\d+)\.(\d+)/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

// Negative when `a` is older than `b`.
function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

// Older than the pin is an error, not a warning: 2.0.10's XCUITest driver broke
// `launchApp: clearState: true` outright, so the flows fail in a way that reads
// as an app bug. Newer is allowed — fixes accumulate — but is worth naming.
function checkMaestroVersion() {
  const bin = process.env.MAESTRO_BIN || 'maestro'
  let output
  try {
    output = execFileSync(bin, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    console.error(
      `Error: '${bin}' not found or not runnable.\n` +
        `Fix: MAESTRO_VERSION=${PINNED_MAESTRO} curl -fsSL "https://get.maestro.mobile.dev" | bash`,
    )
    process.exit(1)
  }

  const found = parseVersion(output)
  const pinned = parseVersion(PINNED_MAESTRO)
  if (!found) {
    console.warn(`Warning: could not read a version from '${bin} --version'; skipping the check.`)
    return
  }

  const delta = compareVersions(found, pinned)
  if (delta < 0) {
    console.error(
      [
        '',
        `Error: Maestro ${found.join('.')} is older than the pinned ${PINNED_MAESTRO}.`,
        'CI installs the pinned version, so local runs would exercise a different CLI.',
        `Fix: MAESTRO_VERSION=${PINNED_MAESTRO} curl -fsSL "https://get.maestro.mobile.dev" | bash`,
        '',
      ].join('\n'),
    )
    process.exit(1)
  }
  if (delta > 0) {
    console.log(`Maestro ${found.join('.')} (newer than the pinned ${PINNED_MAESTRO})`)
    return
  }
  console.log(`Maestro ${PINNED_MAESTRO}`)
}

checkMaestroVersion()

function checkAndroidEmulator() {
  const attached = execFileSync('adb', ['devices'], { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial]) => serial)

  // adb itself honours ANDROID_SERIAL, so when it is set the downstream E2E
  // steps already target that device — only this gate has to agree.
  const requestedSerial = process.env.ANDROID_SERIAL
  let serial

  if (requestedSerial) {
    const requested = attached.find(([attachedSerial]) => attachedSerial === requestedSerial)
    if (!requested) {
      console.error(
        `Error: ANDROID_SERIAL is set to ${requestedSerial}, but adb does not list that device.\n` +
          'Fix: run `adb devices`, then set ANDROID_SERIAL to a listed serial or unset it.',
      )
      process.exit(1)
    }
    if (requested[1] !== 'device') {
      console.error(
        `Error: Android device ${requestedSerial} is in state '${requested[1]}', not 'device'.\n` +
          'Fix: wait for it to finish starting (or authorise it), then re-run.',
      )
      process.exit(1)
    }
    serial = requestedSerial
  } else {
    const devices = attached.filter(([, state]) => state === 'device')
    if (devices.length !== 1) {
      console.error(
        `Error: expected exactly one ready Android emulator, found ${devices.length}.\n` +
          'Fix: boot one emulator, wait for it to finish starting, then re-run.',
      )
      process.exit(1)
    }
    ;[serial] = devices[0]
  }

  const bootCompleted = execFileSync('adb', ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], {
    encoding: 'utf8',
  }).trim()
  const apiLevel = execFileSync('adb', ['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk'], {
    encoding: 'utf8',
  }).trim()

  if (bootCompleted !== '1') {
    console.error(`Error: Android emulator ${serial} is connected but has not finished booting.`)
    process.exit(1)
  }
  if (apiLevel !== ANDROID_API_LEVEL) {
    console.error(`Error: Android emulator ${serial} runs API ${apiLevel || '?'}, expected API ${ANDROID_API_LEVEL}.`)
    process.exit(1)
  }

  console.log(`Android emulator is running: ${serial} (API ${apiLevel}).`)
}

if (E2E_PLATFORM === 'android') {
  checkAndroidEmulator()
  process.exit(0)
}

if (E2E_PLATFORM !== 'ios') {
  console.error(`Error: unsupported E2E_PLATFORM '${E2E_PLATFORM}'. Expected 'ios' or 'android'.`)
  process.exit(1)
}

// Highest iOS major exercised here with Maestro 2.6.1 or newer. Bump only after
// a newer iOS runtime is verified; this ceiling is not a teardown-health claim.
const MAX_SUPPORTED_IOS_MAJOR = 26

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
      `Error: the booted simulator runs iOS ${major}, which this project's Maestro setup`,
      'has not been verified to drive here.',
      `Booted: ${offending}`,
      '',
      `Fix: boot a simulator on iOS ${MAX_SUPPORTED_IOS_MAJOR} or older, e.g.`,
      '  xcrun simctl list devices | grep -i "iOS 26"   # find one',
      '  xcrun simctl boot "<device UDID>"',
      'Then install the app on it and re-run.',
      '',
      'Override: E2E_ALLOW_UNSUPPORTED_IOS=1 npm run test:e2e:mock',
    ].join('\n'),
  )
  process.exit(1)
}

if (unsupported.length > 0 && allowUnsupported) {
  console.warn(
    `Warning: running on iOS ${unsupported[0].major ?? '?'} with E2E_ALLOW_UNSUPPORTED_IOS=1 — ` +
      'above the verified ceiling; flows may fail if Maestro cannot drive this runtime.',
  )
}

console.log('iOS simulator is running.')

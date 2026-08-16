#!/usr/bin/env node
'use strict'
const { execFileSync } = require('child_process')
const { existsSync, readdirSync, readFileSync, writeFileSync } = require('fs')
const os = require('os')
const path = require('path')

const BUNDLE_ID = 'com.ronenmars.threadbase'
const APP_NAME = 'Threadbase.app'
const REPO_ROOT = path.join(__dirname, '..')

// Both halves of the E2E workflow build and install the Release app themselves
// before this shared suite starts, and `E2E_PLATFORM` is set only there — so it
// is the signal for "the runner already did this". Keep the freshness/install
// guard below for every local path.
//
// iOS was missing from this list, and the cost was not a duplicate build: the
// workflow builds with `-derivedDataPath build/ios-ci`, which `findReleaseBuild`
// does not probe, so the script concluded there was no build at all and ran
// `expo run:ios --configuration Release` from scratch — which then holds Metro
// open and opens the dev-client URL. Run 31927177499 spent its whole 75-minute
// budget there and was cancelled without executing a single flow.
const RUNNER_INSTALLED = {
  android: 'Android Release APK was installed by the E2E runner.',
  ios: 'iOS Release build was installed by the E2E runner.',
}
if (RUNNER_INSTALLED[process.env.E2E_PLATFORM]) {
  console.log(RUNNER_INSTALLED[process.env.E2E_PLATFORM])
  process.exit(0)
}

// Set to reuse a build we know is stale (or can't prove is fresh) rather than
// rebuilding — mirrors e2e/check-sim.js's E2E_ALLOW_UNSUPPORTED_IOS escape hatch.
const ALLOW_STALE = process.env.E2E_ALLOW_STALE_BUILD === '1'

// `expo run:ios --configuration Release` may emit the .app either into a
// project-local `ios/build/...` dir or (Expo's default) a hashed Xcode
// DerivedData dir. Probe both so the fast "reuse existing build" path can fire
// instead of always rebuilding from scratch. Returns the first match, or null.
function findReleaseBuild() {
  const localPath = path.join(__dirname, '../ios/build/Build/Products/Release-iphonesimulator', APP_NAME)
  if (existsSync(localPath)) return localPath

  const derivedRoot = path.join(os.homedir(), 'Library/Developer/Xcode/DerivedData')
  if (!existsSync(derivedRoot)) return null
  for (const dir of readdirSync(derivedRoot)) {
    if (!dir.startsWith('Threadbase-')) continue
    const candidate = path.join(derivedRoot, dir, 'Build/Products/Release-iphonesimulator', APP_NAME)
    if (existsSync(candidate)) return candidate
  }
  return null
}

// A Release build bakes the compiled JS bundle and the native binary into one
// non-incremental artifact — there is no live-reload path for it the way a
// Debug/dev-client build gets from Metro. So "is this build current" cannot be
// scoped to just app/ or just ios/: any tracked or untracked source change
// (JS or native) invalidates it equally, and the only way to refresh either is
// the same full `expo run:ios --configuration Release` rebuild. That is why
// freshness below is gated on the whole git working tree, not on file mtimes
// of the .app or its embedded main.jsbundle — mtimes get touched by unrelated
// operations (checkout, copy, simctl install) without the content changing,
// which is exactly the kind of false signal this check exists to rule out.
function gitState() {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' })
    return { sha, dirty: status.trim().length > 0 }
  } catch {
    return null
  }
}

function stampPath(appPath) {
  return `${appPath}.build-stamp.json`
}

function readStamp(appPath) {
  const file = stampPath(appPath)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeStamp(appPath, sha) {
  writeFileSync(stampPath(appPath), JSON.stringify({ sha, builtAt: new Date().toISOString() }, null, 2))
}

// Pure decision function — no I/O — so the guard logic is unit-testable
// without a simulator, a real git repo, or a real build.
//
// A dirty working tree has no clean HEAD to stamp or compare against, and
// deciding "probably fine" here is exactly the silent-pass bug this guard
// exists to close — so a dirty tree is always treated as stale, never warned.
function checkBuildFreshness({ git, stamp }) {
  if (!git) return { fresh: false, reason: 'could not determine git state (not a git repo, or git unavailable)' }
  if (git.dirty) return { fresh: false, reason: 'working tree has uncommitted changes' }
  if (!stamp) return { fresh: false, reason: 'existing build has no freshness stamp' }
  if (stamp.sha !== git.sha) {
    return { fresh: false, reason: `existing build was stamped for ${stamp.sha.slice(0, 7)}, HEAD is now ${git.sha.slice(0, 7)}` }
  }
  return { fresh: true, reason: `build matches HEAD (${git.sha.slice(0, 7)})` }
}

function installAndLaunch(appPath) {
  console.log(`Installing verified build...\n  ${appPath}`)
  execFileSync('xcrun', ['simctl', 'install', 'booted', appPath], { stdio: 'inherit' })
  execFileSync('xcrun', ['simctl', 'launch', 'booted', BUNDLE_ID], { stdio: 'inherit' })
}

// The Sentry config plugin injects a sentry-cli phase into every non-Debug
// build, and that phase fails the build outright when the upload credentials
// are absent — which they are for anyone running the mock suite locally. A
// local E2E build has no use for uploaded source maps, so resolve the same
// `development` env e2e.yml uses rather than hardcoding a second flag here.
function resolveSentryEnv() {
  const out = execFileSync('/bin/bash', [path.join(REPO_ROOT, 'scripts/check-sentry-env.sh')], {
    env: { ...process.env, APP_ENV: 'development' },
    encoding: 'utf8',
  })
  return Object.fromEntries(
    out
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const at = line.indexOf('=')
        return [line.slice(0, at), line.slice(at + 1)]
      }),
  )
}

// Only called for the true first-run case (no build found anywhere) — `npx expo
// run:ios --configuration Release` is documented (docs/e2e-remaining-work.md,
// "Environment gotchas") to hold Metro open and never return once it finishes
// building, so it must not be reachable from the "stale" path, where a dirty
// working tree makes it the common case rather than a rare first-run one.
function buildFresh() {
  console.log('Building Release build now (this may take a few minutes)...')
  execFileSync('npx', ['expo', 'run:ios', '--configuration', 'Release'], {
    stdio: 'inherit',
    env: { ...process.env, ...resolveSentryEnv() },
  })

  const appPath = findReleaseBuild()
  if (!appPath) {
    console.error(
      [
        '',
        'Error: the Release build finished but no .app was found afterward at either',
        '  ios/build/Build/Products/Release-iphonesimulator/Threadbase.app',
        '  ~/Library/Developer/Xcode/DerivedData/Threadbase-*/Build/Products/Release-iphonesimulator/Threadbase.app',
        'Something is wrong with the build output — refusing to proceed with an unverified build.',
      ].join('\n'),
    )
    process.exit(1)
  }

  const git = gitState()
  if (git && !git.dirty) writeStamp(appPath, git.sha)
  return appPath
}

function main() {
  console.log('Checking for a current Release build...')

  const localAppPath = findReleaseBuild()

  if (!localAppPath) {
    console.log('No existing Release build found. Building...')
    installAndLaunch(buildFresh())
    grantSpeechRecognition()
    return
  }

  const git = gitState()
  const stamp = readStamp(localAppPath)
  const freshness = checkBuildFreshness({ git, stamp })

  if (freshness.fresh) {
    console.log(`Release build is current: ${freshness.reason}.`)
    installAndLaunch(localAppPath)
  } else if (ALLOW_STALE) {
    console.warn(
      `Warning: reusing an existing build that is NOT verified current (${freshness.reason}).\n` +
        'E2E_ALLOW_STALE_BUILD=1 is set, so proceeding anyway — results may not reflect the current source tree.',
    )
    installAndLaunch(localAppPath)
  } else {
    // Issue #598 asks that a stale build fail loudly, not that this script fix
    // it for you: auto-rebuilding here would run the blocking `expo run:ios`
    // build on every dirty working tree (the normal state during development),
    // and that build is known to hang holding Metro open (see buildFresh()) —
    // trading a silent wrong pass for a silent hang. Fail and let the caller
    // choose to rebuild or explicitly opt into reusing the stale build.
    console.error(
      [
        '',
        `Error: existing Release build is stale (${freshness.reason}).`,
        'Refusing to reuse it silently.',
        '',
        'Fix: rebuild it — `npm run ios -- --configuration Release` — then re-run this script.',
        'Escape hatch: set E2E_ALLOW_STALE_BUILD=1 to reuse the existing build anyway.',
      ].join('\n'),
    )
    process.exit(1)
  }

  grantSpeechRecognition()
}

// Voice dictation Maestro flow asserts `chat-mic-button`, which only mounts
// after speech-recognition permission is granted. Fresh/erase'd sims have none.
function grantSpeechRecognition() {
  const services = ['speech-recognition', 'microphone']
  for (const service of services) {
    try {
      execFileSync('xcrun', ['simctl', 'privacy', 'booted', 'grant', service, BUNDLE_ID], {
        stdio: 'inherit',
      })
      console.log(`Granted ${service} to ${BUNDLE_ID}`)
    } catch {
      console.warn(`Could not grant ${service} (simctl may use a different service name)`)
    }
  }
}

main()

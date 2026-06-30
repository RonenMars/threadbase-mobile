#!/usr/bin/env node
'use strict'
const { execFileSync } = require('child_process')
const { existsSync, readdirSync } = require('fs')
const os = require('os')
const path = require('path')

const BUNDLE_ID = 'com.ronenmars.threadbase'
const APP_NAME = 'Threadbase.app'

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

console.log('Checking for Release build on simulator...')

// Check if Release build exists on booted simulator
let installedBuildType
try {
  const appPath = execFileSync('xcrun', ['simctl', 'get_app_container', 'booted', BUNDLE_ID], { encoding: 'utf8' }).trim()

  // Release builds embed the JS bundle (main.jsbundle) and have no dev-client
  // launcher; dev-client builds ship EXDevLauncher.bundle and load JS from
  // Metro at runtime. The old `_expo`-dir heuristic mis-classified dev-client
  // builds as Release (they have no `_expo` dir either), letting the wrong
  // build slip past this gate — so detect on the embedded bundle instead.
  const isRelease =
    existsSync(path.join(appPath, 'main.jsbundle')) &&
    !existsSync(path.join(appPath, 'EXDevLauncher.bundle'))
  installedBuildType = isRelease ? 'Release' : 'Debug'

  console.log(`Found ${installedBuildType} build installed.`)
} catch (err) {
  console.log('No build installed on simulator.')
  installedBuildType = null
}

// If Debug build is installed, or no build at all, install Release
if (installedBuildType !== 'Release') {
  console.log('Installing Release build for E2E tests...')

  // Check if Release build exists locally
  const releaseBuildPath = findReleaseBuild()
  if (!releaseBuildPath) {
    console.log('Release build not found. Building now (this may take a few minutes)...')
    execFileSync('npx', ['expo', 'run:ios', '--configuration', 'Release'], { stdio: 'inherit' })
  } else {
    console.log(`Found existing Release build. Installing...\n  ${releaseBuildPath}`)
    execFileSync('xcrun', ['simctl', 'install', 'booted', releaseBuildPath], { stdio: 'inherit' })
    execFileSync('xcrun', ['simctl', 'launch', 'booted', BUNDLE_ID], { stdio: 'inherit' })
  }

  console.log('Release build ready.')
} else {
  console.log('Release build already installed. Launching...')
  execFileSync('xcrun', ['simctl', 'launch', 'booted', BUNDLE_ID], { stdio: 'inherit' })
}

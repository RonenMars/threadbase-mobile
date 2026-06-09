#!/usr/bin/env node
'use strict'
const { execFileSync } = require('child_process')
const { existsSync } = require('fs')
const path = require('path')

const BUNDLE_ID = 'com.threadbase.mobile'
const RELEASE_BUILD_PATH = path.join(__dirname, '../ios/build/Build/Products/Release-iphonesimulator/ThreadbaseMobile.app')

console.log('Checking for Release build on simulator...')

// Check if Release build exists on booted simulator
let installedBuildType
try {
  const appPath = execFileSync('xcrun', ['simctl', 'get_app_container', 'booted', BUNDLE_ID], { encoding: 'utf8' }).trim()

  // Check if it's a Release build by looking for embedded.mobileprovision (Release) vs dev-client marker
  const isRelease = !existsSync(path.join(appPath, '_expo'))
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
  if (!existsSync(RELEASE_BUILD_PATH)) {
    console.log('Release build not found. Building now (this may take a few minutes)...')
    execFileSync('npx', ['expo', 'run:ios', '--configuration', 'Release'], { stdio: 'inherit' })
  } else {
    console.log('Found existing Release build. Installing...')
    execFileSync('xcrun', ['simctl', 'install', 'booted', RELEASE_BUILD_PATH], { stdio: 'inherit' })
    execFileSync('xcrun', ['simctl', 'launch', 'booted', BUNDLE_ID], { stdio: 'inherit' })
  }

  console.log('Release build ready.')
} else {
  console.log('Release build already installed. Launching...')
  execFileSync('xcrun', ['simctl', 'launch', 'booted', BUNDLE_ID], { stdio: 'inherit' })
}

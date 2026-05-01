#!/usr/bin/env node
'use strict'
const { execFileSync } = require('child_process')
const devices = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'devices', '--json']).toString())
const booted = Object.values(devices.devices).flat().some(s => s.state === 'Booted')
if (!booted) {
  console.error('Error: No booted iOS simulator found.\nFix: open -a Simulator, then wait for it to boot.')
  process.exit(1)
}
console.log('iOS simulator is running.')

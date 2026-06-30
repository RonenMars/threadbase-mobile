#!/usr/bin/env node
// Start Metro and advertise the cloudflared tunnel URL to the dev client.
//
// Expo's own .env loader exports EXPO_PUBLIC_* into the bundle but does NOT
// inject EXPO_PACKAGER_PROXY_URL into the CLI's process env in time for the
// dev-server URL logic to read it — so the QR/deep link falls back to the LAN
// IP. We read it from .env ourselves and put it in the real env before expo
// starts, so the advertised Metro URL is the tunnel hostname.

const { spawn } = require('child_process')
const { readFileSync } = require('fs')
const { join } = require('path')

let proxyUrl = process.env.EXPO_PACKAGER_PROXY_URL

if (!proxyUrl) {
  try {
    const env = readFileSync(join(process.cwd(), '.env'), 'utf8')
    const line = env.split('\n').find((l) => l.startsWith('EXPO_PACKAGER_PROXY_URL='))
    if (line) proxyUrl = line.slice('EXPO_PACKAGER_PROXY_URL='.length).trim()
  } catch {
    // no .env — fall through to the warning below
  }
}

if (!proxyUrl) {
  console.error(
    'Warning: EXPO_PACKAGER_PROXY_URL not set in env or .env — Metro will advertise the LAN IP.'
  )
}

const args = ['expo', 'start', '--dev-client', ...process.argv.slice(2)]
spawn('npx', args, {
  stdio: 'inherit',
  env: proxyUrl ? { ...process.env, EXPO_PACKAGER_PROXY_URL: proxyUrl } : process.env,
}).on('exit', (code) => process.exit(code ?? 0))

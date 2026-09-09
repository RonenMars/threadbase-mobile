#!/usr/bin/env node
'use strict'

// Runs e2e/leave_session_nav.yaml once per (session mode × leave option)
// combination against a REAL threadbase-streamer — the mock server has no PTY,
// so it cannot produce the live session the leave-session modal guards.
//
// Start the streamer first:  cd ../tb-streamer && npm run dev:verbose
//
// Overridable: E2E_MOCK_SERVER_URL (default http://localhost:8766) and
// E2E_SERVER_TOKEN (default: the api_key in ~/.threadbase/server.yaml).
//
// Args narrow the matrix: `node e2e/run-leave-nav.js kill` or `... new/kill`.

const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const OPTIONS = ['kill', 'leave', 'kill_on_idle']
const MODES = ['new', 'resumed']
const REPO_ROOT = path.join(__dirname, '..')
// Every session this script spawns is killed again at the end of its combo, so
// the project only has to be a real directory the streamer is allowed to open.
const SESSION_PATH = REPO_ROOT

function streamerToken() {
  if (process.env.E2E_SERVER_TOKEN) return process.env.E2E_SERVER_TOKEN
  const yaml = path.join(os.homedir(), '.threadbase/server.yaml')
  const match = fs.existsSync(yaml) && /^api_key:\s*(\S+)/m.exec(fs.readFileSync(yaml, 'utf8'))
  if (!match) {
    console.error('No E2E_SERVER_TOKEN set and no api_key found in ~/.threadbase/server.yaml.')
    process.exit(1)
  }
  return match[1]
}

function streamer(url, token) {
  // The streamer closes some responses (the NDJSON stop stream) as soon as it
  // is done writing, which surfaces here as `fetch failed / write EPIPE`. That
  // is a transport artefact of a request that did its job, so it must not take
  // the run down — every caller below treats `ok: false` as "nothing to do".
  const call = async (method, apiPath, body) => {
    try {
      return await request(method, apiPath, body)
    } catch (err) {
      return { ok: false, status: 0, text: String(err) }
    }
  }
  const request = async (method, apiPath, body) => {
    const res = await fetch(`${url}${apiPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, text }
  }
  return {
    info: () => call('GET', '/api/info'),
    // The 200 shape is `{ session }`; a slow spawn answers 202 `{ id, status:
    // 'pending' }`, which is not usable as a row id — treat it as a failure
    // rather than tapping a row that does not exist yet.
    start: async () => {
      const res = await request('POST', '/api/sessions/start', {
        path: SESSION_PATH,
        projectName: path.basename(SESSION_PATH),
      })
      if (!res.ok) throw new Error(`start failed: ${res.status} ${res.text.slice(0, 200)}`)
      const parsed = JSON.parse(res.text)
      const id = parsed?.session?.id
      if (!id) throw new Error(`start did not return a ready session: ${res.text.slice(0, 200)}`)
      return id
    },
    stop: (id) => call('POST', `/api/sessions/${encodeURIComponent(id)}/stop`),
    live: async () => {
      const res = await call('GET', '/api/sessions')
      if (!res.ok) return []
      return JSON.parse(res.text).filter((s) => s.ptyAttached)
    },
  }
}

function runFlow(env) {
  const args = ['test']
  for (const [key, value] of Object.entries(env)) args.push('-e', `${key}=${value}`)
  args.push('--debug-output', 'e2e/_artifacts/debug', 'e2e/leave_session_nav.yaml')
  return spawnSync(process.execPath, [path.join(__dirname, 'run-maestro.js'), ...args], {
    stdio: 'inherit',
    cwd: REPO_ROOT,
  }).status
}

async function main() {
  const url = process.env.E2E_MOCK_SERVER_URL || 'http://localhost:8766'
  const token = streamerToken()
  const api = streamer(url, token)

  const probe = await api.info().catch((err) => ({ ok: false, status: err.message }))
  if (!probe.ok) {
    console.error(`Streamer at ${url} did not answer GET /api/info (${probe.status}).`)
    console.error('Start it with `npm run dev:verbose` in tb-streamer.')
    process.exit(1)
  }

  const only = process.argv.slice(2)
  const combos = []
  for (const mode of MODES) {
    for (const option of OPTIONS) {
      const name = `${mode}/${option}`
      if (only.length === 0 || only.includes(name) || only.includes(option) || only.includes(mode)) {
        combos.push({ mode, option, name })
      }
    }
  }

  const results = []
  for (const combo of combos) {
    console.log(`\n=== leave_session_nav: ${combo.name} ===`)
    let existingId = ''
    if (combo.mode === 'resumed') existingId = await api.start()
    try {
      results.push({
        ...combo,
        code: runFlow({
          E2E_MOCK_SERVER_URL: url,
          E2E_SERVER_TOKEN: token,
          LEAVE_OPTION: combo.option,
          SESSION_MODE: combo.mode,
          EXISTING_SESSION_ID: existingId,
        }),
      })
    } finally {
      // "Leave it" and "Kill on idle" deliberately keep the PTY alive, and a
      // failed flow can strand one at any point — so never let a combo hand
      // the next one a machine full of live agents.
      for (const session of await api.live()) await api.stop(session.id)
    }
  }

  console.log('\n=== summary ===')
  for (const r of results) console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.name}`)
  process.exit(results.some((r) => r.code !== 0) ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

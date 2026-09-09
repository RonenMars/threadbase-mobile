#!/usr/bin/env node
'use strict'

// Runs e2e/leave_session_nav.yaml once per (session mode × leave option)
// combination against a REAL threadbase-streamer — the mock server has no PTY,
// so it cannot produce the live session the leave-session modal guards.
//
// Start the streamer first:  cd ../tb-streamer && npm run dev:verbose
//
// Overridable: REAL_STREAMER_CONTROL_URL (Node HTTP), REAL_STREAMER_APP_URL
// (paired inside the app), REAL_STREAMER_SESSION_PATH (path on the streamer),
// and E2E_SERVER_TOKEN (default: the api_key in ~/.threadbase/server.yaml).
//
// Args narrow the matrix: `node e2e/run-leave-nav.js kill` or `... new/kill`.

const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const OPTIONS = ['kill', 'leave', 'kill_on_idle']
const MODES = ['new', 'resumed']
const REPO_ROOT = path.join(__dirname, '..')
const DEFAULT_READY_TIMEOUT_MS = 120_000
const DEFAULT_READY_POLL_MS = 500

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

function streamer(url, token, options = {}) {
  const readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS
  const readyPollMs = options.readyPollMs ?? DEFAULT_READY_POLL_MS
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
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
    start: async (sessionPath) => {
      const res = await request('POST', '/api/sessions/start', {
        path: sessionPath,
        projectName: path.basename(sessionPath),
      })
      if (!res.ok) throw new Error(`start failed: ${res.status} ${res.text.slice(0, 200)}`)
      const parsed = JSON.parse(res.text)
      if (parsed?.session?.id) return parsed.session.id
      if (res.status !== 202 || !parsed?.id) {
        throw new Error(`start did not return a session id: ${res.text.slice(0, 200)}`)
      }

      const deadline = Date.now() + readyTimeoutMs
      while (Date.now() < deadline) {
        const pending = await call('GET', `/api/sessions/${encodeURIComponent(parsed.id)}`)
        if (pending.ok) {
          const session = JSON.parse(pending.text)
          if (session.ptyAttached === true || session.status === 'waiting_input') return parsed.id
          if (session.status === 'idle' || session.lifecycle === 'failed' || session.failureReason) {
            throw new Error(`session ${parsed.id} failed while starting: ${pending.text.slice(0, 200)}`)
          }
        }
        await sleep(readyPollMs)
      }
      throw new Error(`session ${parsed.id} did not become ready within ${readyTimeoutMs}ms`)
    },
    stop: (id) => call('POST', `/api/sessions/${encodeURIComponent(id)}/stop`),
    sessions: async () => {
      const res = await call('GET', '/api/sessions')
      if (!res.ok) return []
      const parsed = JSON.parse(res.text)
      return Array.isArray(parsed) ? parsed : parsed.sessions ?? []
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

async function runMatrix({ api, appUrl, token, sessionPath, only = [], run = runFlow }) {
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
    const before = new Set((await api.sessions()).map((session) => session.id))
    const owned = new Set()
    let existingId = ''
    if (combo.mode === 'resumed') {
      existingId = await api.start(sessionPath)
      owned.add(existingId)
    }
    try {
      results.push({
        ...combo,
        code: run({
          E2E_MOCK_SERVER_URL: appUrl,
          E2E_SERVER_TOKEN: token,
          LEAVE_OPTION: combo.option,
          SESSION_MODE: combo.mode,
          EXISTING_SESSION_ID: existingId,
        }),
      })
    } finally {
      // A new-mode flow creates its session inside the app, so the controller
      // learns that id by comparing the server's rows with the pre-flow
      // snapshot. Pre-existing rows are never eligible for cleanup.
      for (const session of await api.sessions()) {
        if (!before.has(session.id)) owned.add(session.id)
      }
      for (const id of owned) await api.stop(id)
    }
  }

  return results
}

async function main() {
  const legacyUrl = process.env.E2E_MOCK_SERVER_URL || 'http://localhost:8766'
  const controlUrl = process.env.REAL_STREAMER_CONTROL_URL || legacyUrl
  const appUrl = process.env.REAL_STREAMER_APP_URL || legacyUrl
  const sessionPath = process.env.REAL_STREAMER_SESSION_PATH || REPO_ROOT
  const token = streamerToken()
  const api = streamer(controlUrl, token, {
    readyTimeoutMs: Number(process.env.REAL_STREAMER_READY_TIMEOUT_MS) || DEFAULT_READY_TIMEOUT_MS,
    readyPollMs: Number(process.env.REAL_STREAMER_READY_POLL_MS) || DEFAULT_READY_POLL_MS,
  })

  const probe = await api.info().catch((err) => ({ ok: false, status: err.message }))
  if (!probe.ok) {
    console.error(`Streamer at ${controlUrl} did not answer GET /api/info (${probe.status}).`)
    console.error('Start it with `npm run dev:verbose` in tb-streamer.')
    process.exit(1)
  }

  const only = process.argv.slice(2)
  const results = await runMatrix({ api, appUrl, token, sessionPath, only })

  console.log('\n=== summary ===')
  for (const r of results) console.log(`${r.code === 0 ? 'PASS' : 'FAIL'}  ${r.name}`)
  process.exit(results.some((r) => r.code !== 0) ? 1 : 0)
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

module.exports = { runMatrix, streamer }

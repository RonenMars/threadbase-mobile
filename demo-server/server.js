#!/usr/bin/env node
'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')
const { WebSocketServer } = require('ws')

// Comma-separated list of ports; first is primary, additional ports serve the
// same fixtures so e2e flows can pair multiple servers.
const PORTS = (process.env.PORT ?? process.env.MOCK_PORTS ?? process.env.MOCK_PORT ?? '7071')
  .split(',')
  .map((p) => parseInt(p.trim(), 10))
  .filter((p) => Number.isFinite(p))
const FIXTURES = path.join(__dirname, 'fixtures')

// ntfy.sh push channel — fires when reviewers / demo visitors pair against
// the server. Subscribe in the ntfy iOS app with the topic name to receive
// pushes. Override via NTFY_TOPIC env var.
const NTFY_TOPIC = process.env.NTFY_TOPIC ?? 'threadbase-demo-3e8e6ff52142'
const NTFY_ENABLED = NTFY_TOPIC && NTFY_TOPIC !== 'off'

// Throttle pushes to avoid spam if the WS reconnects in a loop.
let lastNtfyAt = 0
function notify(title, message, priority = 'default') {
  if (!NTFY_ENABLED) return
  const now = Date.now()
  if (now - lastNtfyAt < 30_000) return // 1 push per 30s max
  lastNtfyAt = now
  fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    headers: { Title: title, Priority: priority, Tags: 'iphone,test_tube' },
    body: message,
  }).catch(() => {}) // fire-and-forget
}

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8')
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

function makeHandler() {
  return (req, res) => handleRequest(req, res)
}

function handleRequest(req, res) {
  const method = req.method
  const host = req.headers.host ?? 'localhost'
  const url = new URL(req.url, `http://${host}`)
  const p = url.pathname

  console.log(`${method} ${p}`)

  const auth = req.headers['authorization'] ?? ''
  if (!auth.startsWith('Bearer ') || auth.slice(7).trim() === '') {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (method === 'GET' && p === '/api/sessions') {
    notify('Demo paired', 'Someone is browsing sessions on the demo server.', 'default')
    const sessions = JSON.parse(readFixture('sessions.json'))
    const hasPaginationParams =
      url.searchParams.has('limit') ||
      url.searchParams.has('cursor') ||
      url.searchParams.has('sortBy') ||
      url.searchParams.has('order') ||
      url.searchParams.has('status')
    if (!hasPaginationParams) {
      return json(res, 200, sessions)
    }
    // Mock streamer always returns one full page (the fixture is small).
    return json(res, 200, {
      sessions,
      nextCursor: null,
      total: sessions.length,
    })
  }

  if (method === 'GET' && p === '/api/conversations') {
    return json(res, 200, readFixture('conversations.json'))
  }

  // Conversation detail.
  // - bug6 fixture (`conversation-detail-many.json`) has 30 messages to force
  //   vertical scroll past the bottom action bar.
  // - feat2 fixture (`conversation-detail.json`) is a minimal payload for the
  //   export-in-info-shelf flow.
  // - Unknown ids get an empty body — the screen renders the empty-state copy.
  const conversationMatch = p.match(/^\/api\/conversations\/([^/]+)$/)
  if (method === 'GET' && conversationMatch) {
    if (conversationMatch[1] === 'conv-many-messages') {
      return json(res, 200, readFixture('conversation-detail-many.json'))
    }
    if (conversationMatch[1] === 'conv-111') {
      return json(res, 200, readFixture('conversation-detail.json'))
    }
    return json(res, 200, {
      meta: { id: conversationMatch[1], project_name: 'Empty conversation' },
      messages: [],
      message_pagination: { total: 0, before_index: -1, from_index: 0, has_more_older: false, next_before_index: null },
    })
  }

  const sessionMatch = p.match(/^\/api\/sessions\/([^/]+)$/)
  if (method === 'GET' && sessionMatch) {
    const reqId = sessionMatch[1]
    if (reqId === 'session-missing-path') {
      return json(res, 200, readFixture('session-missing-path.json'))
    }
    if (reqId === 'session-waiting') {
      return json(res, 200, readFixture('session-waiting-input.json'))
    }
    // Pull the status/timing fields from the matching sessions.json entry so
    // the detail screen agrees with the hub. Without this every detail was
    // status:'running' regardless of which card was tapped, which kept the
    // "Counting to a trillion…" wake-up overlay on screen forever for any
    // session that wasn't actually running.
    const sessions = JSON.parse(readFixture('sessions.json'))
    const match = sessions.find((s) => s.id === reqId)
    if (match) {
      return json(res, 200, {
        id: match.id,
        status: match.status,
        ptyAttached: match.ptyAttached ?? true,
        projectPath: match.projectPath,
        projectName: match.projectName,
        branch: match.branch,
        lastOutput: match.lastOutput ?? '',
        elapsedMs: match.elapsedMs ?? 0,
        promptCount: match.promptCount ?? 0,
        startedAt: match.startedAt,
      })
    }
    return json(res, 200, readFixture('session-detail.json'))
  }

  const outputMatch = p.match(/^\/api\/sessions\/([^/]+)\/output$/)
  if (method === 'GET' && outputMatch) {
    return json(res, 200, readFixture('terminal-output.json'))
  }

  // Stub info endpoint — used by the app on connect
  if (method === 'GET' && p === '/api/info') {
    return json(res, 200, {
      version: '0.0.0-mock',
      machineName: 'mock-machine',
      platform: 'linux',
      activeSessions: 1,
    })
  }

  // Stub profiles endpoint — used by useTBPair during onboarding handshake
  // in production builds. Returning 200 with an empty profile is enough for
  // the pair flow to advance past `handshake` into `paired`.
  if (method === 'GET' && p === '/api/profiles') {
    return json(res, 200, { profiles: [] })
  }

  // Stub conversations count
  if (method === 'GET' && p === '/api/conversations/count') {
    return json(res, 200, { count: 2 })
  }

  // Stub sessions count
  if (method === 'GET' && p === '/api/sessions/count') {
    return json(res, 200, { count: 3 })
  }

  // Stub browse — returns no subdirectories regardless of `path`. The Maestro
  // flow only needs the breadcrumb row to render the requested cwd; it does
  // not exercise directory navigation.
  if (method === 'GET' && p === '/api/browse') {
    return json(res, 200, { directories: [] })
  }

  // Endpoints used by the Hub that the local Maestro suite did not exercise
  // but the real app hits on every server load. Return empty so the app does
  // not retry-storm against the demo server.
  if (method === 'GET' && p === '/api/sessions/names') {
    return json(res, 200, { names: {} })
  }
  if (method === 'GET' && p === '/api/sessions/recents') {
    return json(res, 200, { sessions: [] })
  }
  if (method === 'GET' && p === '/api/projects/popular') {
    return json(res, 200, { projects: [] })
  }

  // Generic POSTs we accept and ignore (no persistence in the demo).
  if (method === 'POST' && p === '/api/push/register') {
    return json(res, 200, { ok: true })
  }

  json(res, 404, { error: 'Not found' })
}

// Canned terminal lines we replay on subscribe_session. Mirrors what a real
// Claude Code session looks like in the terminal viewer.
const REPLAY_LINES = [
  '$ claude',
  '',
  '╭───────────────────────────────────────────────╮',
  '│ Welcome to Claude Code                        │',
  '│                                               │',
  '│   /help for help, /status for your current    │',
  '│   setup                                       │',
  '╰───────────────────────────────────────────────╯',
  '',
  '> Take a look at the README and tell me what this project does.',
  '',
  '⏺ I will read the README and summarize it.',
  '',
  '⏺ Read(README.md)',
  '  ⎿  Read 142 lines (ctrl+r to expand)',
  '',
  "⏺ This is **Threadbase Mobile**, a companion app for monitoring",
  '  and controlling Claude Code agent sessions running on a remote',
  '  Threadbase server. Key capabilities:',
  '',
  '  - Live session monitoring with real-time status updates',
  '  - Embedded VT100 terminal output viewer',
  '  - Prompt queue for active sessions',
  '  - Multi-server support with QR-code pairing',
  '  - Push notifications for session lifecycle events',
  '',
  'The app is built on Expo SDK 56 (React Native 0.85.3) and',
  'distributes via EAS Build to TestFlight.',
  '',
  '> _',
]

// Periodic ticks we send after replay so the screen shows "live" activity.
const LIVE_TICKS = [
  '\nWaiting for input…\n',
  '\n[idle] no new input for 30s\n',
  '\nWaiting for input…\n',
]

function emitWS(ws, msg) {
  if (ws.readyState !== ws.OPEN) return
  try { ws.send(JSON.stringify(msg)) } catch {}
}

function attachWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (url.pathname !== '/ws') {
      socket.destroy()
      return
    }
    // Allow any non-empty key (consistent with the HTTP Bearer policy).
    const key = url.searchParams.get('key')
    if (!key) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })

  wss.on('connection', (ws) => {
    console.log('WS connected')
    const intervals = []

    // Keep Fly's edge proxy from dropping idle WebSockets. Fly closes WS
    // connections that go ~60s without any frames; a server-initiated ping
    // every 25s comfortably stays under that. The client never has to know.
    const keepalive = setInterval(() => {
      if (ws.readyState !== ws.OPEN) return
      try { ws.ping() } catch {}
    }, 25_000)
    intervals.push(keepalive)

    ws.on('close', () => {
      intervals.forEach(clearInterval)
      console.log('WS disconnected')
    })

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { return }
      console.log('WS recv', msg.type)

      if (msg.type === 'subscribe_session' && msg.sessionId) {
        notify('Demo session opened', `Subscribed to ${msg.sessionId}.`, 'high')
        // Delay slightly before sending terminal_replay. The app's
        // `useTerminalStream` registers the `terminal_replay` listener AFTER
        // calling `client.send({ type: 'subscribe_session', ... })`; against
        // a low-latency server (like Fly) the reply can arrive in the same
        // microtask, before the listener is registered, and the screen sits
        // on its loader forever. ~150ms is enough headroom for the JS turn
        // to complete on the client. This is a workaround for a real client
        // bug; remove once the client patches the registration order.
        setTimeout(() => {
          emitWS(ws, {
            type: 'terminal_replay',
            sessionId: msg.sessionId,
            lines: REPLAY_LINES,
          })
        }, 150)

        // Then drip a "live" tick every ~6 seconds so the screen feels alive.
        let i = 0
        const tickInterval = setInterval(() => {
          emitWS(ws, {
            type: 'terminal_output',
            sessionId: msg.sessionId,
            data: LIVE_TICKS[i % LIVE_TICKS.length],
          })
          i++
        }, 6000)
        intervals.push(tickInterval)
      }
    })
  })
}

// Bind to 0.0.0.0 so Fly's proxy can reach us (Fly injects PORT).
const HOST = process.env.HOST ?? '0.0.0.0'
for (const port of PORTS) {
  const server = http.createServer(makeHandler())
  attachWebSocket(server)
  server.listen(port, HOST, () => {
    console.log(`Threadbase demo server listening on http://${HOST}:${port}`)
  })
}

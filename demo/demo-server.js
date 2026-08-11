#!/usr/bin/env node
'use strict'

// Demo server for recording marketing videos on a REAL device.
//
//   node demo/demo-server.js
//
// 1. Phone and Mac on the same Wi-Fi.
// 2. In the app: connect a server with  http://<LAN IP printed below>:7071
//    and ANY api key (all tokens are accepted).
// 3. Hub shows 4 sessions with live ambient updates. Open "threadbase-shop"
//    (waiting for approval), type anything, hit send — a scripted ~11s live
//    Claude response streams in (thinking → edits → tests → green).
// 4. Restart the server between takes to reset state.
//
// Unlike e2e/mock-server.js (CI fixtures, static), this file is
// self-contained, holds mutable state, and pushes timed WS frames so the
// screen animates on camera. Not used by tests or CI.

const http = require('http')
const os = require('os')
const { WebSocketServer } = require('ws')

const PORT = parseInt(process.env.DEMO_PORT ?? '7071', 10)

const now = Date.now()
const minsAgo = (m) => new Date(now - m * 60_000).toISOString()

// ---------------------------------------------------------------------------
// Demo cast — 4 sessions across 2 machines
// ---------------------------------------------------------------------------

const sessions = [
  {
    id: 'sess-checkout',
    status: 'waiting_input',
    ptyAttached: true,
    projectPath: '/Users/dev/work/threadbase-shop',
    projectName: 'threadbase-shop',
    branch: 'fix/checkout-flaky-test',
    machineName: 'MacBook Pro',
    lastOutput: 'Plan ready — waiting for approval',
    promptCount: 6,
    startedAt: minsAgo(24),
    conversationId: 'conv-checkout',
  },
  {
    id: 'sess-darkmode',
    status: 'running',
    ptyAttached: true,
    projectPath: '/Users/dev/work/threadbase-web',
    projectName: 'threadbase-web',
    branch: 'feat/dark-mode',
    machineName: 'MacBook Pro',
    lastOutput: 'Editing ThemeProvider.tsx',
    promptCount: 11,
    startedAt: minsAgo(47),
    conversationId: 'conv-darkmode',
  },
  {
    id: 'sess-billing',
    status: 'running',
    ptyAttached: true,
    projectPath: '/home/dev/services/billing-api',
    projectName: 'billing-api',
    branch: 'feat/stripe-webhooks',
    machineName: 'Home Server',
    lastOutput: 'Writing handler for invoice.paid',
    promptCount: 4,
    startedAt: minsAgo(12),
    conversationId: 'conv-billing',
  },
  {
    id: 'sess-docs',
    status: 'idle',
    ptyAttached: false,
    projectPath: '/home/dev/services/docs-site',
    projectName: 'docs-site',
    branch: 'main',
    machineName: 'Home Server',
    lastOutput: '42 tests passed — PR opened',
    promptCount: 9,
    startedAt: minsAgo(95),
    conversationId: 'conv-docs',
  },
]

const withElapsed = (s) => ({ ...s, elapsedMs: Date.now() - Date.parse(s.startedAt) })

// ---------------------------------------------------------------------------
// Conversation histories (REST) — markdown text renders in the chat view
// ---------------------------------------------------------------------------

function history(id, projectName, projectPath, branch, msgs) {
  return {
    meta: {
      id,
      project_name: projectName,
      project_path: projectPath,
      git_branch: branch,
      message_count: msgs.length,
      last_updated_at: new Date().toISOString(),
    },
    messages: msgs.map((m, i) => ({
      uuid: `${id}-m${i}`,
      role: m.role,
      message_index: i,
      timestamp: minsAgo(msgs.length - i + 1),
      text: m.text,
    })),
    message_pagination: {
      from_index: 0,
      total: msgs.length,
      has_more_older: false,
      next_before_index: null,
    },
  }
}

const conversations = {
  'conv-checkout': history(
    'conv-checkout',
    'threadbase-shop',
    '/Users/dev/work/threadbase-shop',
    'fix/checkout-flaky-test',
    [
      {
        role: 'user',
        text: 'The checkout E2E test fails maybe once in five runs on CI. Find the race and fix it.',
      },
      {
        role: 'assistant',
        text: 'Reproduced it — 3 failures out of 20 local runs, always the same assertion:\n\n```\nexpect(cartBadge).toHaveText("0")\nExpected: "0"  Received: "1"\n```\n\nDigging into the order-submission flow now.',
      },
      {
        role: 'assistant',
        text: 'Found it. `submitOrder()` resolves before the cart badge re-renders, so the assertion sometimes runs one frame early.\n\n**Plan:**\n1. Wait for the `order-confirmed` element instead of the 500ms sleep\n2. Delete the flaky `setTimeout` in the test helper\n3. Re-run the suite 20 times to confirm\n\nApply the fix?',
      },
    ],
  ),
  'conv-darkmode': history(
    'conv-darkmode',
    'threadbase-web',
    '/Users/dev/work/threadbase-web',
    'feat/dark-mode',
    [
      { role: 'user', text: 'Add a dark theme. Reuse the token system, no hardcoded colors.' },
      {
        role: 'assistant',
        text: 'Mapped all 62 color tokens to dark variants and wired the `ThemeProvider` toggle. Updating the 9 components that still import raw hex values, then running the snapshot suite.',
      },
    ],
  ),
  'conv-billing': history(
    'conv-billing',
    'billing-api',
    '/home/dev/services/billing-api',
    'feat/stripe-webhooks',
    [
      { role: 'user', text: 'Handle the invoice.paid and invoice.payment_failed Stripe webhooks with retries.' },
      {
        role: 'assistant',
        text: 'Signature verification and idempotency keys are in. Writing the `invoice.paid` handler now, `payment_failed` with exponential backoff next.',
      },
    ],
  ),
  'conv-docs': history('conv-docs', 'docs-site', '/home/dev/services/docs-site', 'main', [
    { role: 'user', text: 'Update the getting-started guide for the new CLI flags and fix broken links.' },
    {
      role: 'assistant',
      text: 'Done. Rewrote the install section for the new `--profile` flag, fixed 7 dead links, and all 42 docs tests pass. PR #218 is open and CI is green.',
    },
  ]),
}

const conversationList = Object.values(conversations).map((c) => ({
  id: c.meta.id,
  title: c.messages[0].text.slice(0, 60),
  projectPath: c.meta.project_path,
  branch: c.meta.git_branch,
  messageCount: c.meta.message_count,
  lastActivity: c.meta.last_updated_at,
}))

// ---------------------------------------------------------------------------
// WebSocket plumbing
// ---------------------------------------------------------------------------

const clients = new Set()
const broadcast = (msg) => {
  const data = JSON.stringify(msg)
  for (const ws of clients) if (ws.readyState === 1) ws.send(data)
}

let uuidCounter = 0
const jsonlLine = (role, content) =>
  JSON.stringify({
    type: role,
    uuid: `live-${++uuidCounter}`,
    timestamp: new Date().toISOString(),
    message: { role, content },
  })

// Ambient hub activity: rotate lastOutput on running sessions so cards tick.
const AMBIENT = {
  'sess-darkmode': [
    'Editing ThemeProvider.tsx',
    'Editing tokens.ts',
    'Running snapshot tests',
    '142 tests passed',
    'Editing SettingsScreen.tsx',
  ],
  'sess-billing': [
    'Writing handler for invoice.paid',
    'Reading webhooks/stripe.ts',
    'Running integration tests',
    'Adding retry with backoff',
    '18 tests passed',
  ],
}
let ambientTick = 0
setInterval(() => {
  ambientTick++
  for (const s of sessions) {
    const lines = AMBIENT[s.id]
    if (!lines || s.status !== 'running') continue
    s.lastOutput = lines[ambientTick % lines.length]
    broadcast({ type: 'session_update', session: withElapsed(s) })
  }
}, 2500)

// Scripted live response — fires when the phone POSTs input to any session.
// ~11s: thinking → edit → tests (20x) → green → back to waiting_input.
function runLiveScript(session, inputText) {
  const sid = session.id
  session.status = 'running'
  session.promptCount++
  session.lastOutput = 'Applying fix'
  broadcast({ type: 'user_message', sessionId: sid, text: inputText, ts: Date.now() })
  broadcast({ type: 'session_update', session: withElapsed(session) })

  const steps = [
    [400, () =>
      broadcast({
        type: 'conversation_event',
        sessionId: sid,
        line: jsonlLine('assistant', [
          {
            type: 'thinking',
            thinking:
              'The sleep-based wait is the race — replace it with an explicit wait on the confirmation element, then re-run the suite enough times to prove it.',
          },
        ]),
      })],
    [1600, () =>
      broadcast({
        type: 'conversation_event',
        sessionId: sid,
        line: jsonlLine('assistant', [{ type: 'text', text: 'Applying the fix now.' }]),
      })],
    [2600, () => {
      session.lastOutput = 'Editing checkout.spec.ts'
      broadcast({ type: 'session_update', session: withElapsed(session) })
      broadcast({
        type: 'conversation_event',
        sessionId: sid,
        line: jsonlLine('assistant', [
          { type: 'tool_use', name: 'Edit', input: { file_path: 'e2e/checkout.spec.ts' } },
        ]),
      })
      broadcast({ type: 'terminal_output', sessionId: sid, data: '\r\n● Edit e2e/checkout.spec.ts\r\n' })
    }],
    [3700, () =>
      broadcast({
        type: 'conversation_event',
        sessionId: sid,
        line: jsonlLine('user', [
          { type: 'tool_result', content: 'Edited e2e/checkout.spec.ts — replaced sleep(500) with waitFor(order-confirmed)' },
        ]),
      })],
    [4700, () => {
      session.lastOutput = 'Running tests 20x'
      broadcast({ type: 'session_update', session: withElapsed(session) })
      broadcast({
        type: 'conversation_event',
        sessionId: sid,
        line: jsonlLine('assistant', [
          { type: 'tool_use', name: 'Bash', input: { command: 'npx playwright test checkout --repeat-each=20' } },
        ]),
      })
      broadcast({ type: 'terminal_output', sessionId: sid, data: '$ npx playwright test checkout --repeat-each=20\r\n' })
    }],
    [6200, () => broadcast({ type: 'terminal_output', sessionId: sid, data: 'Running 20 tests using 4 workers\r\n' })],
    [7800, () => {
      broadcast({
        type: 'conversation_event',
        sessionId: sid,
        line: jsonlLine('user', [
          { type: 'tool_result', content: '20 passed, 0 flaky (38.2s)' },
        ]),
      })
      broadcast({ type: 'terminal_output', sessionId: sid, data: '  20 passed (38.2s)\r\n' })
    }],
    [9200, () =>
      broadcast({
        type: 'conversation_event',
        sessionId: sid,
        line: jsonlLine('assistant', [
          {
            type: 'text',
            text: 'Fixed and verified — 20 consecutive green runs.\n\nThe test now waits for the `order-confirmed` element instead of a 500ms sleep. Committed to `fix/checkout-flaky-test` and pushed; CI is running.',
          },
        ]),
      })],
    [10600, () => {
      session.status = 'waiting_input'
      session.lastOutput = 'Fix verified — 20/20 green'
      broadcast({ type: 'session_update', session: withElapsed(session) })
    }],
  ]
  for (const [delay, fn] of steps) setTimeout(fn, delay)
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const p = url.pathname
  console.log(`${req.method} ${p}`)

  if (req.method === 'POST' && /^\/api\/sessions\/[^/]+\/input$/.test(p)) {
    const id = p.split('/')[3]
    const session = sessions.find((s) => s.id === id)
    let raw = ''
    req.setEncoding('utf-8')
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      let text = ''
      try {
        text = JSON.parse(raw).input ?? ''
      } catch {}
      if (session && text) runLiveScript(session, text)
      json(res, 200, { ok: true })
    })
    return
  }

  if (req.method !== 'GET') return json(res, 404, { error: 'Not found' })

  if (p === '/api/sessions') {
    const list = sessions.map(withElapsed)
    const paginated = url.searchParams.has('limit') || url.searchParams.has('cursor')
    return json(res, 200, paginated ? { sessions: list, nextCursor: null, total: list.length } : list)
  }
  const sessionMatch = p.match(/^\/api\/sessions\/([^/]+)$/)
  if (sessionMatch) {
    const s = sessions.find((x) => x.id === sessionMatch[1])
    return s ? json(res, 200, withElapsed(s)) : json(res, 404, { error: 'Not found' })
  }
  if (/^\/api\/sessions\/[^/]+\/output$/.test(p)) {
    return json(res, 200, { lines: ['$ claude', 'Session resumed', 'Plan ready — waiting for approval'] })
  }
  if (p === '/api/sessions/count') return json(res, 200, { count: sessions.length })
  if (p === '/api/conversations') return json(res, 200, conversationList)
  if (p === '/api/conversations/count') return json(res, 200, { count: conversationList.length })
  const convMatch = p.match(/^\/api\/conversations\/([^/]+)$/)
  if (convMatch) {
    const c = conversations[convMatch[1]]
    if (c) return json(res, 200, c)
    return json(res, 200, {
      meta: { id: convMatch[1], project_name: 'Live session' },
      messages: [],
      message_pagination: { total: 0, before_index: -1, from_index: 0, has_more_older: false, next_before_index: null },
    })
  }
  if (p === '/api/info') {
    return json(res, 200, { version: '1.0.0-demo', machineName: 'MacBook Pro', platform: 'darwin', activeSessions: sessions.length })
  }
  if (p === '/api/profiles') return json(res, 200, { profiles: [] })
  if (p === '/api/browse') return json(res, 200, { directories: [] })
  json(res, 404, { error: 'Not found' })
})

const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  if (!req.url || !req.url.startsWith('/ws')) return socket.destroy()
  wss.handleUpgrade(req, socket, head, (ws) => {
    clients.add(ws)
    ws.on('close', () => clients.delete(ws))
    ws.on('message', () => {})
    ws.send(JSON.stringify({ type: 'session_list', sessions: sessions.map(withElapsed) }))
    ws.send(JSON.stringify({ type: 'cache_ready' }))
  })
})

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
  console.log(`Demo server on port ${PORT}. Connect the app to:`)
  for (const ip of ips) console.log(`  http://${ip}:${PORT}   (any api key)`)
})

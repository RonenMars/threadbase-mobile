#!/usr/bin/env node
'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')
const { WebSocketServer } = require('ws')

// Comma-separated list of ports; first is primary, additional ports serve the
// same fixtures so e2e flows can pair multiple servers.
const PORTS = (process.env.MOCK_PORTS ?? process.env.MOCK_PORT ?? '7071')
  .split(',')
  .map((p) => parseInt(p.trim(), 10))
  .filter((p) => Number.isFinite(p))
const FIXTURES = path.join(__dirname, 'fixtures')

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8')
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function makeHandler() {
  return (req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('mock-server error:', err)
      json(res, 500, { error: 'Internal mock server error' })
    })
  }
}

async function handleRequest(req, res) {
  const method = req.method
  const host = req.headers.host ?? 'localhost'
  const url = new URL(req.url, `http://${host}`)
  const p = url.pathname

  console.log(`${method} ${p}`)

  const auth = req.headers['authorization'] ?? ''
  const bearerToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  // A fixed bad-token value lets e2e flows deterministically exercise the
  // "invalid credentials" path (any other non-empty token is accepted).
  if (bearerToken === '' || bearerToken === 'wrong-token-000') {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (method === 'GET' && p === '/api/sessions') {
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
    const project = url.searchParams.get('project')
    const all = JSON.parse(readFixture('conversations.json'))
    // The grouped views fetch one project at a time (?project=<path>), so the
    // mock has to filter like the real streamer or every group would show the
    // whole fixture. Exact path match, newest first — same contract.
    if (project) {
      const rows = all
        .filter((c) => c.projectPath === project)
        .sort((a, b) => Date.parse(b.lastActivity) - Date.parse(a.lastActivity))
      return json(res, 200, {
        conversations: rows,
        hasMore: false,
        offset: 0,
        total: rows.length,
      })
    }
    return json(res, 200, all)
  }

  // Project summaries — the group list the tree/hub build their structure from.
  // Aggregated from the same fixture the conversation list serves, so a group's
  // count always matches the page behind it (the real server's guarantee).
  if (method === 'GET' && p === '/api/projects/summary') {
    const byPath = new Map()
    for (const c of JSON.parse(readFixture('conversations.json'))) {
      const entry = byPath.get(c.projectPath) ?? { count: 0, lastActivity: '' }
      entry.count += 1
      if (c.lastActivity > entry.lastActivity) entry.lastActivity = c.lastActivity
      byPath.set(c.projectPath, entry)
    }
    const projects = [...byPath.entries()]
      .map(([projectPath, { count, lastActivity }]) => ({
        path: projectPath,
        name: projectPath.split('/').filter(Boolean).pop() ?? projectPath,
        conversationCount: count,
        lastActivity,
      }))
      .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity) || a.path.localeCompare(b.path))
    return json(res, 200, { projects, total: projects.length, offset: 0, hasMore: false })
  }

  // Search: metadata-only match list, mirroring the real streamer's
  // /api/search contract (no message-level index — see search-target below).
  if (method === 'GET' && p === '/api/search') {
    return json(res, 200, readFixture('search-results.json'))
  }

  // Search-target resolver: HTTP QUERY (RFC 10008) — the query travels as a
  // JSON body ({ q }) instead of a URL param, matching the real streamer.
  // The search-anchor e2e flow's fixture conversation resolves "wombat" to
  // message_index 210 (the last of two matches). Everything else 404s with
  // the real streamer's error shape.
  const searchTargetMatch = p.match(/^\/api\/conversations\/([^/]+)\/search-target$/)
  if (method === 'QUERY' && searchTargetMatch) {
    const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim()
    if (contentType && contentType !== 'application/json') {
      res.setHeader('Accept-Query', 'application/json')
      return json(res, 415, { error: 'Unsupported Content-Type; expected application/json', code: 'unsupported_media_type' })
    }
    let body
    try {
      body = await readJsonBody(req)
    } catch {
      res.setHeader('Accept-Query', 'application/json')
      return json(res, 422, { error: 'Malformed JSON body', code: 'invalid_query' })
    }
    const q = typeof body.q === 'string' ? body.q.trim() : ''
    if (!q) {
      res.setHeader('Accept-Query', 'application/json')
      return json(res, 422, { error: 'Missing or empty query field: q', code: 'invalid_query' })
    }
    res.setHeader('Accept-Query', 'application/json')
    if (searchTargetMatch[1] === 'conv-search-anchor' && q === 'wombat') {
      return json(res, 200, readFixture('conv-search-target.json'))
    }
    return json(res, 404, { error: 'No message body matches query', code: 'search_target_not_found' })
  }

  // Conversation detail.
  // - bug6 fixture (`conversation-detail-many.json`) has 30 messages to force
  //   vertical scroll past the bottom action bar.
  // - feat2 fixture (`conversation-detail.json`) is a minimal payload for the
  //   export-in-info-shelf flow.
  // - search-anchor fixture (`conv-search-anchor.json`) has 250 messages;
  //   serves the anchored window [150,250) when requested with anchor_index,
  //   otherwise the plain last-80-message tail like a real streamer would.
  // - Unknown ids get an empty body — the screen renders the empty-state copy.
  const conversationMatch = p.match(/^\/api\/conversations\/([^/]+)$/)
  if (method === 'GET' && conversationMatch) {
    if (conversationMatch[1] === 'conv-many-messages') {
      return json(res, 200, readFixture('conversation-detail-many.json'))
    }
    // Perf-repro fixtures: code-heavy vs text-only first page (80 messages each).
    if (conversationMatch[1] === 'conv-code-heavy') {
      return json(res, 200, readFixture('conv-code-heavy.json'))
    }
    if (conversationMatch[1] === 'conv-text-only') {
      return json(res, 200, readFixture('conv-text-only.json'))
    }
    if (conversationMatch[1] === 'conv-111') {
      return json(res, 200, readFixture('conversation-detail.json'))
    }
    if (conversationMatch[1] === 'conv-codex-1') {
      return json(res, 200, readFixture('codex-conversation-detail.json'))
    }
    // Scroll-gaps regression fixture (07_conversation_scroll_gaps.yaml): row
    // heights mirroring the real conversation that reproduced the blank-gap
    // bug — two ~3,000pt markdown-table answers and a tall code fence between
    // 50-350pt rows. The delta poll's after_index window is served with the
    // real streamer's INCLUSIVE [after_index, after_index + limit) semantics:
    // a client that resumes from its max held index re-downloads the tail row
    // every poll (the duplicate-append bug this fixture regression-tests),
    // while a client that resumes from maxHeld + 1 gets an empty page.
    if (conversationMatch[1] === 'conv-scroll-gaps') {
      // readFixture returns the raw string; this route needs the parsed object.
      const fixture = JSON.parse(readFixture('conv-scroll-gaps.json'))
      if (url.searchParams.has('after_index')) {
        const total = fixture.message_pagination.total
        const limit = Math.max(1, parseInt(url.searchParams.get('msg_limit') ?? '80', 10) || 80)
        const from = Math.min(Math.max(parseInt(url.searchParams.get('after_index'), 10) || 0, 0), total)
        const to = Math.min(total, from + limit)
        return json(res, 200, {
          meta: fixture.meta,
          messages: fixture.messages.slice(from, to),
          message_pagination: {
            total,
            before_index: to,
            from_index: from,
            has_more_older: from > 0,
            next_before_index: from > 0 ? from : null,
            has_more_newer: to < total,
            next_after_index: to < total ? to : null,
          },
        })
      }
      return json(res, 200, fixture)
    }
    if (conversationMatch[1] === 'conv-search-anchor') {
      if (url.searchParams.has('anchor_index')) {
        return json(res, 200, readFixture('conv-search-anchor.json'))
      }
      // Non-anchored requests (tail view, or an older mobile build that never
      // sends anchor_index) get an empty-but-valid tail so the screen doesn't
      // depend on this fixture outside the search-anchor flow.
      return json(res, 200, {
        meta: { id: conversationMatch[1], project_name: 'Search anchor e2e fixture', message_count: 250 },
        messages: [],
        message_pagination: { total: 250, before_index: 250, from_index: 250, has_more_older: false, next_before_index: null },
      })
    }
    return json(res, 200, {
      meta: { id: conversationMatch[1], project_name: 'Empty conversation' },
      messages: [],
      message_pagination: { total: 0, before_index: -1, from_index: 0, has_more_older: false, next_before_index: null },
    })
  }

  const sessionMatch = p.match(/^\/api\/sessions\/([^/]+)$/)
  if (method === 'GET' && sessionMatch) {
    if (sessionMatch[1] === 'session-missing-path') {
      return json(res, 200, readFixture('session-missing-path.json'))
    }
    // waiting_input status enables the input bar without a live WS
    // (used by the keyboard-layout e2e flow).
    if (sessionMatch[1] === 'session-waiting') {
      return json(res, 200, readFixture('session-waiting-input.json'))
    }
    if (sessionMatch[1] === 'session-first-run') {
      return json(res, 200, readFixture('session-first-run.json'))
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
      // Without this the grouped views treat the mock as a pre-summary
      // streamer and render the upgrade prompt instead of a tree.
      projectSummary: true,
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

  json(res, 404, { error: 'Not found' })
}

for (const port of PORTS) {
  const server = http.createServer(makeHandler())

  // The app opens ws://host/ws?key=<apiKey> for live session updates
  // (services/ws-client.ts). Without a handler the socket never opens and the
  // hub shows "Disconnected — showing cached sessions", which fails the live
  // flows. Accept the upgrade, keep the socket open, and push an initial
  // session_list so the hub renders live data.
  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    if (!req.url || !req.url.startsWith('/ws')) {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const sessions = JSON.parse(readFixture('sessions.json'))
      ws.send(JSON.stringify({ type: 'session_list', sessions }))
      ws.send(JSON.stringify({ type: 'cache_ready' }))
      // Swallow client messages (auth/register); the flows don't need replies.
      ws.on('message', () => {})
    })
  })

  server.listen(port, () => {
    console.log(`Mock server listening on http://localhost:${port}`)
  })
}

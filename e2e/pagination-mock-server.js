#!/usr/bin/env node
'use strict'

// Pagination mock — serves a configurable large set of conversations + a
// handful of sessions so the mobile app exercises its multi-page fetch loop
// (`fetchAllConversationPagesForServer` in hooks/useConversations.ts uses
// limit=50, paging until total is reached).
//
// Separate from e2e/mock-server.js to keep the existing flows stable.
//
// Env vars:
//   MOCK_PORT — listen port (default 7072)
//   MOCK_TOTAL_CONVERSATIONS — how many fake conversations to serve (default 346)
//   MOCK_TOTAL_SESSIONS — how many fake sessions (default 5)
//
// Endpoints:
//   GET  /healthz                                      → ok
//   GET  /api/info                                      → version stub
//   GET  /api/profiles                                  → empty profile list
//   GET  /api/sessions[?limit&sortBy&order&status]       → paginated sessions
//   GET  /api/sessions/count                             → { total }
//   GET  /api/sessions/recents[?limit]                   → recents list
//   GET  /api/projects/popular[?limit]                   → popular projects
//   GET  /api/conversations[?limit&offset&project&refresh] → paginated
//   GET  /api/conversations/count[?project&refresh]      → { total }
//   POST /api/pair/exchange                              → handshake stub
//   POST /api/__client-log                               → accept + log
//   GET  /__mock/requests                                → request log (test-only)
//   POST /__mock/reset                                   → clear request log

const http = require('http')

const PORT = parseInt(process.env.MOCK_PORT || '7072', 10)
const TOTAL_CONVERSATIONS = parseInt(process.env.MOCK_TOTAL_CONVERSATIONS || '346', 10)
const TOTAL_SESSIONS = parseInt(process.env.MOCK_TOTAL_SESSIONS || '5', 10)

// In-memory request log so the maestro flow can assert pagination behaviour.
// Reset with POST /__mock/reset, read with GET /__mock/requests.
const requestLog = []

function generateConversations(total) {
  const out = []
  // Spread across a handful of projects so hub view shows multiple rows.
  // Conversations per project: ~total / projects (round up).
  const projects = [
    { path: '/home/test/alpha-service', name: 'alpha-service' },
    { path: '/home/test/beta-app', name: 'beta-app' },
    { path: '/home/test/gamma-cli', name: 'gamma-cli' },
    { path: '/home/test/delta-web', name: 'delta-web' },
    { path: '/home/test/epsilon-mobile', name: 'epsilon-mobile' },
  ]
  const baseTs = Date.parse('2026-05-24T00:00:00.000Z')
  for (let i = 0; i < total; i++) {
    const p = projects[i % projects.length]
    // Most recent first (ts decreases as i grows) so the list reads naturally.
    const ts = new Date(baseTs - i * 60_000).toISOString()
    out.push({
      id: `conv-${String(i).padStart(4, '0')}`,
      title: `Conversation #${i}`,
      projectPath: p.path,
      branch: i % 3 === 0 ? 'main' : `feat/branch-${i % 7}`,
      messageCount: 4 + (i % 20),
      lastActivity: ts,
      lastMessage: {
        role: 'assistant',
        timestamp: ts,
        text: `Message body for conversation ${i}.`,
      },
    })
  }
  return out
}

function generateSessions(total) {
  const out = []
  const baseTs = Date.parse('2026-05-24T16:00:00.000Z')
  for (let i = 0; i < total; i++) {
    const ts = new Date(baseTs - i * 30_000).toISOString()
    out.push({
      id: `sess-${String(i).padStart(4, '0')}`,
      conversationId: `sess-${String(i).padStart(4, '0')}`,
      // Make first session live so the LiveSessionsHeader renders amber.
      status: i === 0 ? 'waiting_input' : 'idle',
      projectPath: '/home/test/alpha-service',
      projectName: 'alpha-service',
      branch: 'main',
      lastOutput: '',
      elapsedMs: 60_000 + i * 1000,
      promptCount: i + 1,
      startedAt: ts,
      lastActivityAt: ts,
      ptyAttached: i === 0,
      projectId: 'proj-alpha',
    })
  }
  return out
}

const ALL_CONVERSATIONS = generateConversations(TOTAL_CONVERSATIONS)
const ALL_SESSIONS = generateSessions(TOTAL_SESSIONS)

function json(res, status, body) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function logRequest(req, url, status) {
  requestLog.push({
    ts: new Date().toISOString(),
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    status,
  })
}

function handle(req, res) {
  const host = req.headers.host ?? `localhost:${PORT}`
  const url = new URL(req.url, `http://${host}`)
  const p = url.pathname
  const method = req.method

  // Read body for POST/PUT before we route, since pair-exchange needs it.
  // Mock keeps it tiny — drop on the floor.
  let bodyChunks = []
  req.on('data', (c) => bodyChunks.push(c))
  req.on('end', () => {
    let status = 200

    // Test-only inspection endpoints (NO auth required).
    if (method === 'GET' && p === '/__mock/requests') {
      status = 200
      logRequest(req, url, status)
      return json(res, status, { requests: requestLog })
    }
    if (method === 'POST' && p === '/__mock/reset') {
      requestLog.length = 0
      status = 200
      logRequest(req, url, status)
      return json(res, status, { ok: true })
    }

    // Healthcheck doesn't need auth (matches real streamer's auth middleware).
    if (method === 'GET' && p === '/healthz') {
      status = 200
      logRequest(req, url, status)
      return json(res, status, { ok: true, version: '0.0.0-pagination-mock' })
    }

    // Pair-exchange endpoint doesn't need auth.
    if (method === 'POST' && p === '/api/pair/exchange') {
      status = 200
      logRequest(req, url, status)
      // Echo a minimal valid pair response. The mobile pair-exchange flow
      // verifies a server-encrypted payload in production; for e2e we stub a
      // pass-through token.
      return json(res, status, {
        apiKey: 'mock-key-pagination',
        publicKey: 'mock-pubkey',
        machineName: 'pagination-mock',
        version: '0.0.0-pagination-mock',
      })
    }

    // All other endpoints require Bearer auth (per streamer behavior).
    const auth = req.headers['authorization'] ?? ''
    if (!auth.startsWith('Bearer ') || auth.slice(7).trim() === '') {
      status = 401
      logRequest(req, url, status)
      return json(res, status, { error: 'Unauthorized' })
    }

    // Accept client-log POSTs from mobile (clientLog.flush target).
    if (method === 'POST' && p === '/api/__client-log') {
      status = 200
      logRequest(req, url, status)
      return json(res, status, { ok: true })
    }

    // /api/info
    if (method === 'GET' && p === '/api/info') {
      status = 200
      logRequest(req, url, status)
      return json(res, status, {
        version: '0.0.0-pagination-mock',
        machineName: 'pagination-mock',
        platform: 'linux',
        activeSessions: ALL_SESSIONS.filter((s) => s.status !== 'idle').length,
        publicUrl: null,
      })
    }

    // /api/profiles
    if (method === 'GET' && p === '/api/profiles') {
      status = 200
      logRequest(req, url, status)
      return json(res, status, { profiles: [] })
    }

    // /api/sessions (paginated shape when params present, bare array otherwise)
    if (method === 'GET' && p === '/api/sessions') {
      const hasParams =
        url.searchParams.has('limit') ||
        url.searchParams.has('sortBy') ||
        url.searchParams.has('order') ||
        url.searchParams.has('status') ||
        url.searchParams.has('cursor')
      status = 200
      logRequest(req, url, status)
      if (!hasParams) return json(res, status, ALL_SESSIONS)
      return json(res, status, {
        sessions: ALL_SESSIONS,
        nextCursor: null,
        total: ALL_SESSIONS.length,
      })
    }

    if (method === 'GET' && p === '/api/sessions/count') {
      status = 200
      logRequest(req, url, status)
      return json(res, status, { total: ALL_SESSIONS.length })
    }

    if (method === 'GET' && p === '/api/sessions/recents') {
      const limit = parseInt(url.searchParams.get('limit') || '10', 10)
      const slice = ALL_SESSIONS.slice(0, limit)
      status = 200
      logRequest(req, url, status)
      return json(res, status, { sessions: slice, total: slice.length })
    }

    if (method === 'GET' && p === '/api/projects/popular') {
      const limit = parseInt(url.searchParams.get('limit') || '10', 10)
      // Aggregate sessions/conversations by projectPath to compute counts.
      const counts = new Map()
      for (const c of ALL_CONVERSATIONS) {
        counts.set(c.projectPath, (counts.get(c.projectPath) || 0) + 1)
      }
      const projects = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([path, sessionCount]) => ({
          path,
          name: path.split('/').filter(Boolean).slice(-2).join('/'),
          sessionCount,
        }))
      status = 200
      logRequest(req, url, status)
      return json(res, status, { projects, total: projects.length })
    }

    // /api/conversations — paginated by limit + offset.
    if (method === 'GET' && p === '/api/conversations') {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10)
      const offset = parseInt(url.searchParams.get('offset') || '0', 10)
      const slice = ALL_CONVERSATIONS.slice(offset, offset + limit)
      const total = ALL_CONVERSATIONS.length
      // ConversationPage shape (camelCase) — mobile's adaptPage handles both
      // array and object responses, but the page form is the modern path.
      status = 200
      logRequest(req, url, status)
      return json(res, status, {
        conversations: slice,
        hasMore: offset + slice.length < total,
        offset,
        total,
      })
    }

    if (method === 'GET' && p === '/api/conversations/count') {
      status = 200
      logRequest(req, url, status)
      return json(res, status, { total: ALL_CONVERSATIONS.length })
    }

    // /project-chats — unified list. Mobile uses this when available.
    if (method === 'GET' && p === '/project-chats') {
      const items = []
      // Sessions
      for (const s of ALL_SESSIONS) {
        items.push({
          type: 'session',
          id: s.id,
          projectId: s.projectId,
          projectPath: s.projectPath,
          title: s.projectName,
          latestMessageAt: s.lastActivityAt,
          updatedAt: s.lastActivityAt,
          createdAt: s.startedAt,
          status: 'active',
          source: 'session-store',
          resumedFromConversationId: null,
        })
      }
      // Conversations
      for (const c of ALL_CONVERSATIONS) {
        items.push({
          type: 'conversation',
          id: c.id,
          projectId: `proj-${c.projectPath.split('/').pop()}`,
          projectPath: c.projectPath,
          title: c.title,
          latestMessageAt: c.lastActivity,
          updatedAt: c.lastActivity,
          createdAt: null,
          status: 'resumable',
          source: 'hdd-cache',
          indexedAt: null,
          fileMtime: null,
          filePath: `/fake/${c.id}.jsonl`,
          sourceHash: null,
        })
      }
      status = 200
      logRequest(req, url, status)
      return json(res, status, { projectChats: items, lastConversationId: ALL_CONVERSATIONS[0]?.id ?? null })
    }

    // Stub anything else with 404 so unexpected endpoints fail loudly.
    status = 404
    logRequest(req, url, status)
    json(res, status, { error: 'Not found', path: p })
  })
}

const server = http.createServer(handle)
server.listen(PORT, () => {
  console.log(`pagination mock listening on http://localhost:${PORT}`)
  console.log(`  → serving ${TOTAL_CONVERSATIONS} conversations, ${TOTAL_SESSIONS} sessions`)
  console.log(`  → request log: GET http://localhost:${PORT}/__mock/requests`)
  console.log(`  → reset log:   POST http://localhost:${PORT}/__mock/reset`)
})

// Graceful shutdown so a runner script can stop cleanly.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0))
  })
}

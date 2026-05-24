#!/usr/bin/env node
'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')

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
    if (sessionMatch[1] === 'session-missing-path') {
      return json(res, 200, readFixture('session-missing-path.json'))
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

  json(res, 404, { error: 'Not found' })
}

for (const port of PORTS) {
  const server = http.createServer(makeHandler())
  server.listen(port, () => {
    console.log(`Mock server listening on http://localhost:${port}`)
  })
}

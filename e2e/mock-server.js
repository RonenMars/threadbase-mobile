#!/usr/bin/env node
'use strict'

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = parseInt(process.env.MOCK_PORT ?? '7071', 10)
const FIXTURES = path.join(__dirname, 'fixtures')

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8')
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  const method = req.method
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const p = url.pathname

  console.log(`${method} ${p}`)

  const auth = req.headers['authorization'] ?? ''
  if (!auth.startsWith('Bearer ') || auth.slice(7).trim() === '') {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (method === 'GET' && p === '/api/sessions') {
    return json(res, 200, readFixture('sessions.json'))
  }

  if (method === 'GET' && p === '/api/conversations') {
    return json(res, 200, readFixture('conversations.json'))
  }

  const sessionMatch = p.match(/^\/api\/sessions\/([^/]+)$/)
  if (method === 'GET' && sessionMatch) {
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

  // Stub conversations count
  if (method === 'GET' && p === '/api/conversations/count') {
    return json(res, 200, { count: 2 })
  }

  // Stub sessions count
  if (method === 'GET' && p === '/api/sessions/count') {
    return json(res, 200, { count: 3 })
  }

  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`Mock server listening on http://localhost:${PORT}`)
})

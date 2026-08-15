#!/usr/bin/env node
'use strict'

// Blocks until the mock server is accepting connections, or fails loudly.
//
// Both callers start it backgrounded (`node e2e/mock-server.js &`) and used to
// follow with a bare `sleep 1`. A backgrounded process that dies during startup
// — most commonly EADDRINUSE, a stale instance still holding the port — takes
// the whole suite down with it in the least legible way available: every flow
// fails against a server that was never there, which reads as an app defect.
// That cost a real debugging session on 2026-08-15.
//
// A fixed sleep is also wrong in the other direction: it is dead time when the
// server binds in 30ms, and too short on a loaded CI runner.
//
// Usage: node e2e/wait-for-mock.js [port]   (default 7071)
//   E2E_MOCK_WAIT_MS overrides the timeout; the tests use it to stay fast.

const net = require('net')

const PORT = Number(process.argv[2] || 7071)
const TIMEOUT_MS = Number(process.env.E2E_MOCK_WAIT_MS || 15000)
const RETRY_MS = 100

function canConnect() {
  return new Promise((resolve) => {
    const socket = net
      .connect({ port: PORT, host: '127.0.0.1' })
      .on('connect', () => {
        socket.destroy()
        resolve(true)
      })
      .on('error', () => resolve(false))
  })
}

async function main() {
  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await canConnect()) {
      console.log(`Mock server is accepting connections on 127.0.0.1:${PORT}.`)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
  }

  console.error(
    `Error: mock server never accepted a connection on 127.0.0.1:${PORT} within ${TIMEOUT_MS}ms.\n` +
      'It is started in the background, so it most likely exited during startup — EADDRINUSE from a\n' +
      "stale instance is the usual cause. Check the output above for the server's own error.\n" +
      `Fix: kill whatever holds the port (lsof -ti :${PORT}), then re-run.`,
  )
  process.exit(1)
}

main()

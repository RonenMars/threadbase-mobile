#!/usr/bin/env node
'use strict'

// Demo streamer for the marketing capture flows (e2e/marketing/*.yaml).
//
// Separate from e2e/mock-server.js on purpose. That mock serves the same
// fixtures on every port and backs the CI suite; this one serves a different
// machine per port (demo-data.js), answers search by actually matching the
// query, and moves a session between running and waiting_input — none of
// which the CI flows want changing underneath them.
//
// Usage: node e2e/marketing/demo-streamer.js      (ports 7071, 7072, 7073)

const http = require('http')
const nacl = require('tweetnacl')
const { WebSocketServer } = require('ws')
const { MACHINES } = require('./demo-data')

const API_KEY = 'mock-key-123'

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}

function listRow(c) {
  return {
    id: c.id,
    title: c.title,
    sessionName: c.title,
    projectPath: c.projectPath,
    branch: c.branch,
    provider: c.provider,
    messageCount: c.messages.length,
    lastActivity: c.lastActivity,
    preview: c.messages[0].text,
    resumable: true,
  }
}

function detail(c, anchorIndex) {
  const total = c.messages.length
  return {
    meta: {
      id: c.id,
      project_name: c.projectPath.split('/').pop(),
      project_path: c.projectPath,
      session_name: c.title,
      git_branch: c.branch,
      message_count: total,
      last_updated_at: c.lastActivity,
      provider: c.provider,
      resumable: true,
    },
    messages: c.messages,
    message_pagination: {
      total,
      before_index: total,
      from_index: 0,
      has_more_older: false,
      next_before_index: null,
      has_more_newer: false,
      next_after_index: null,
      ...(anchorIndex === null ? {} : { anchor_index: anchorIndex }),
    },
  }
}

const terms = (q) => q.toLowerCase().split(/\s+/).filter(Boolean)
const hits = (text, words) => words.filter((w) => text.toLowerCase().includes(w)).length

// The message carrying the most query words, or null when the conversation as
// a whole does not contain every word.
function bestMessage(c, words) {
  const haystack = `${c.title}\n${c.messages.map((m) => m.text).join('\n')}`
  if (words.length === 0 || hits(haystack, words) < words.length) return null
  return c.messages.reduce((best, m) => (hits(m.text, words) > hits(best.text, words) ? m : best))
}

const SNIPPET_LENGTH = 150

function snippetFor(text, words) {
  const flat = text.replace(/\s+/g, ' ')
  const lower = flat.toLowerCase()
  const first = Math.min(...words.map((w) => lower.indexOf(w)).filter((i) => i >= 0))
  const start = Math.max(0, Math.min(first - 20, flat.length - SNIPPET_LENGTH))
  const prefix = start > 0 ? '…' : ''
  const snippet = prefix + flat.slice(start, start + SNIPPET_LENGTH)
  const highlights = []
  for (const w of words) {
    for (let i = snippet.toLowerCase().indexOf(w); i >= 0; i = snippet.toLowerCase().indexOf(w, i + w.length)) {
      highlights.push({ start: i, end: i + w.length })
    }
  }
  return { snippet, highlights }
}

function startMachine(port, seed) {
  const sockets = new Set()
  let machine

  function reset() {
    machine = structuredClone(seed)
    for (const s of machine.sessions) s.machineName = machine.machineName
  }
  reset()

  function broadcast(frame) {
    for (const ws of sockets) {
      try {
        ws.send(JSON.stringify(frame))
      } catch { /* socket closed mid-flight */ }
    }
  }

  function setStatus(s, status, lastOutput) {
    s.status = status
    s.subStatus = null
    s.statusUpdatedAt = new Date().toISOString()
    if (status === 'waiting_input') s.statusSource = 'turn-signal'
    if (lastOutput) s.lastOutput = lastOutput
    broadcast({ type: 'session_update', session: s })
  }

  function replay(sessionId) {
    const lines = machine.terminal[sessionId] ?? []
    return {
      type: 'terminal_replay',
      sessionId,
      lines,
      userMessages: lines
        .filter((l) => /^[❯›] /.test(l))
        .map((l, i) => ({ text: l.slice(2), ts: i + 1 })),
      seq: 1,
      cols: 120,
      rows: 40,
    }
  }

  async function handle(req, res) {
    const url = new URL(req.url, `http://localhost:${port}`)
    const p = url.pathname
    const method = req.method
    console.log(`[${machine.machineName}] ${method} ${p}`)

    // The legacy (pre-E2EE) pairing reply: the api key sealed to the key the
    // client just generated. The pair token is not checked — any deep link
    // pointing here pairs.
    if (method === 'POST' && p === '/api/pair/exchange') {
      const body = await readJsonBody(req)
      const ephemeral = nacl.box.keyPair()
      const nonce = nacl.randomBytes(nacl.box.nonceLength)
      const sealed = nacl.box(
        Buffer.from(API_KEY, 'utf8'),
        nonce,
        Buffer.from(String(body.clientPublicKey ?? ''), 'base64'),
        ephemeral.secretKey,
      )
      return json(res, 200, {
        ciphertext: Buffer.from(sealed).toString('base64'),
        nonce: Buffer.from(nonce).toString('base64'),
        ephemeralPublicKey: Buffer.from(ephemeral.publicKey).toString('base64'),
        machineName: machine.machineName,
      })
    }

    if (req.headers.authorization !== `Bearer ${API_KEY}`) {
      return json(res, 401, { error: 'Unauthorized' })
    }

    // ── flow controls ────────────────────────────────────────────────────────
    if (method === 'POST' && p === '/__demo__/reset') {
      reset()
      broadcast({ type: 'session_list', sessions: machine.sessions })
      return json(res, 200, { ok: true })
    }
    if (method === 'POST' && p === '/__demo__/status') {
      const body = await readJsonBody(req)
      const s = machine.sessions.find((x) => x.id === body.sessionId)
      if (!s) return json(res, 404, { error: 'Unknown session' })
      setStatus(s, body.status, body.lastOutput)
      return json(res, 200, { ok: true })
    }

    if (method === 'GET' && p === '/api/info') {
      return json(res, 200, {
        version: '1.90.0',
        machineName: machine.machineName,
        platform: machine.platform,
        activeSessions: machine.sessions.filter((s) => s.ptyAttached).length,
        projectSummary: true,
      })
    }

    if (method === 'GET' && p === '/api/providers') {
      const provider = (name, version, structuredQuestions) => ({
        name,
        available: true,
        version,
        verifiedAgainst: { min: '0.1.0', captured: [version] },
        capabilities: {
          freshSessionId: name === 'claude-code' ? 'explicit' : 'late-bound',
          resume: 'native',
          systemPrompt: name === 'claude-code' ? 'flag' : 'positional',
          structuredQuestions,
          permissionGates: true,
          liveControl: true,
        },
        warnings: [],
      })
      return json(res, 200, { providers: [provider('claude-code', '2.0.0', true), provider('codex-cli', '0.9.0', false)] })
    }

    if (method === 'GET' && p === '/api/profiles') return json(res, 200, { profiles: [] })
    if (method === 'GET' && p === '/api/browse') return json(res, 200, { directories: [] })
    if (method === 'GET' && p === '/api/devices') return json(res, 200, { available: true, devices: [] })

    // ── sessions ─────────────────────────────────────────────────────────────
    if (method === 'GET' && p === '/api/sessions') {
      const paged = ['limit', 'cursor', 'sortBy', 'order', 'status'].some((k) => url.searchParams.has(k))
      return json(res, 200, paged
        ? { sessions: machine.sessions, nextCursor: null, total: machine.sessions.length }
        : machine.sessions)
    }
    if (method === 'GET' && p === '/api/sessions/count') return json(res, 200, { count: machine.sessions.length })
    if (method === 'GET' && p === '/api/sessions/names') {
      return json(res, 200, Object.fromEntries(machine.sessions.map((s) => [s.id, s.sessionName])))
    }

    // Resuming history starts a live session on the same conversation.
    if (method === 'POST' && p === '/api/sessions/resume') {
      const body = await readJsonBody(req)
      const c = machine.conversations.find((x) => x.id === body.sessionId)
      if (!c) return json(res, 404, { error: 'Unknown conversation' })
      // A CLI started outside Threadbase still owns this transcript. The real
      // streamer refuses to spawn a second writer and offers take-over instead.
      const owner = machine.sessions.find((s) => s.conversationId === c.id && s.ptyAttached)
      if (owner?.ownership === 'external') {
        return json(res, 409, {
          error: 'Conversation is open in another process',
          code: 'CONVERSATION_BUSY',
          detectedBy: ['process_argv'],
          likelyOwner: 'external',
          provider: c.provider,
          canTakeOver: true,
          canForce: false,
          canFork: false,
        })
      }
      if (owner) return json(res, 200, owner)
      const id = `resumed-${c.id}`
      const last = c.messages[c.messages.length - 1]
      const now = new Date().toISOString()
      const resumed = {
        id,
        provider: c.provider,
        status: 'waiting_input',
        statusSource: 'turn-signal',
        subStatus: null,
        ptyAttached: true,
        lifecycle: 'attached',
        ownership: 'managed',
        projectPath: c.projectPath,
        projectName: c.projectPath.split('/').pop(),
        branch: c.branch,
        sessionName: c.title,
        lastOutput: 'Resumed — ready for the next prompt',
        elapsedMs: 0,
        promptCount: c.messages.filter((m) => m.role === 'user').length,
        messageCount: c.messages.length,
        startedAt: now,
        lastActivityAt: now,
        statusUpdatedAt: now,
        conversationId: c.id,
        resumedFromConversationId: c.id,
        machineName: machine.machineName,
      }
      machine.sessions = [resumed, ...machine.sessions.filter((s) => s.id !== id)]
      machine.terminal[id] = [
        `❯ ${c.messages[0].text}`,
        '',
        ...last.text.split('\n').map((l, i) => (i === 0 ? `⏺ ${l}` : `  ${l}`)),
      ]
      broadcast({ type: 'session_update', session: resumed })
      return json(res, 200, { ...resumed })
    }

    const sessionRoute = p.match(/^\/api\/sessions\/([^/]+)(?:\/([a-z-]+))?$/)
    if (sessionRoute) {
      // The conversation screen adopts by conversation id, the session screen by
      // session id.
      const s = machine.sessions.find((x) => x.id === sessionRoute[1] || x.conversationId === sessionRoute[1])
      if (!s) return json(res, 404, { error: 'Session not found' })
      const action = sessionRoute[2]

      if (method === 'GET' && !action) return json(res, 200, s)
      if (method === 'GET' && action === 'output') return json(res, 200, { lines: machine.terminal[s.id] ?? [] })

      // Taking over an externally started CLI: same session, now streamer-owned.
      if (method === 'POST' && action === 'adopt') {
        s.ownership = 'managed'
        delete s.pid
        delete s.processLiveness
        broadcast({ type: 'session_update', session: s })
        return json(res, 200, { sessionId: s.id })
      }

      // A real streamer writes the prompt to the PTY and the turn comes back
      // over the socket, so the reply below is frames, not the HTTP body.
      if (method === 'POST' && action === 'input') {
        const body = await readJsonBody(req)
        const text = String(body.input ?? body.text ?? '').trim()
        json(res, 200, { ok: true })
        const mark = s.provider === 'codex-cli' ? '›' : '❯'
        const bullet = s.provider === 'codex-cli' ? '•' : '⏺'
        const reply = [`${bullet} On it.`, '', '  Read src/sessions/store.ts', '  Read src/sessions/rehydrate.ts']
        machine.terminal[s.id] = [...(machine.terminal[s.id] ?? []), '', `${mark} ${text}`, '', ...reply]
        s.promptCount += 1
        setTimeout(() => {
          broadcast({ type: 'user_message', sessionId: s.id, text, ts: Date.now() })
          broadcast({ type: 'terminal_output', sessionId: s.id, data: `\r\n\r\n${mark} ${text}\r\n`, seq: Date.now() })
          setStatus(s, 'running', 'Working on your follow-up')
        }, 100)
        setTimeout(() => {
          broadcast({ type: 'terminal_output', sessionId: s.id, data: `\r\n${reply.join('\r\n')}\r\n`, seq: Date.now() })
        }, 1200)
        return
      }
    }

    // ── history ──────────────────────────────────────────────────────────────
    const newestFirst = (a, b) => b.lastActivity.localeCompare(a.lastActivity)

    if (method === 'GET' && p === '/api/conversations/count') {
      return json(res, 200, { count: machine.conversations.length })
    }
    if (method === 'GET' && p === '/api/conversations') {
      const project = url.searchParams.get('project')
      const rows = machine.conversations
        .filter((c) => !project || c.projectPath === project)
        .sort(newestFirst)
        .map(listRow)
      return json(res, 200, { conversations: rows, hasMore: false, offset: 0, total: rows.length })
    }
    if (method === 'GET' && p === '/api/projects/summary') {
      const byPath = new Map()
      for (const c of machine.conversations) {
        const entry = byPath.get(c.projectPath) ?? { count: 0, lastActivity: '' }
        entry.count += 1
        if (c.lastActivity > entry.lastActivity) entry.lastActivity = c.lastActivity
        byPath.set(c.projectPath, entry)
      }
      const projects = [...byPath.entries()]
        .map(([path, { count, lastActivity }]) => ({ path, name: path.split('/').pop(), conversationCount: count, lastActivity }))
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
      return json(res, 200, { projects, total: projects.length, offset: 0, hasMore: false })
    }
    if (method === 'GET' && p === '/api/search') {
      const words = terms(url.searchParams.get('q') ?? '')
      const rows = []
      for (const c of [...machine.conversations].sort(newestFirst)) {
        const message = bestMessage(c, words)
        if (message) rows.push({ ...listRow(c), matches: [{ field: 'content', ...snippetFor(message.text, words) }] })
      }
      return json(res, 200, { conversations: rows, hasMore: false, offset: 0, total: rows.length })
    }

    const conversationRoute = p.match(/^\/api\/conversations\/([^/]+)(\/search-target)?$/)
    if (conversationRoute) {
      const c = machine.conversations.find((x) => x.id === conversationRoute[1])
      if (!c) return json(res, 404, { error: 'Conversation not found' })

      if (method === 'QUERY' && conversationRoute[2]) {
        const body = await readJsonBody(req)
        const words = terms(String(body.q ?? ''))
        const message = bestMessage(c, words)
        res.setHeader('Accept-Query', 'application/json')
        if (!message) return json(res, 404, { error: 'No message body matches query', code: 'search_target_not_found' })
        return json(res, 200, {
          query: body.q,
          message_index: message.message_index,
          uuid: message.uuid,
          snippet: snippetFor(message.text, words).snippet,
          match_indexes: [message.message_index],
          total_matches: 1,
        })
      }
      if (method === 'GET' && !conversationRoute[2]) {
        const anchor = url.searchParams.get('anchor_index')
        return json(res, 200, detail(c, anchor === null ? null : Number(anchor)))
      }
    }

    json(res, 404, { error: 'Not found' })
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('demo-streamer error:', err)
      json(res, 500, { error: 'Internal demo streamer error' })
    })
  })

  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    if (!req.url || !req.url.startsWith('/ws')) return socket.destroy()
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.send(JSON.stringify({ type: 'session_list', sessions: machine.sessions }))
      ws.send(JSON.stringify({ type: 'cache_ready' }))
      sockets.add(ws)
      ws.on('close', () => sockets.delete(ws))
      ws.on('message', (raw) => {
        let msg
        try {
          msg = JSON.parse(String(raw))
        } catch {
          return
        }
        if (msg?.type === 'subscribe_session') ws.send(JSON.stringify(replay(msg.sessionId)))
      })
    })
  })

  server.listen(port, '127.0.0.1', () => {
    console.log(`${seed.machineName} listening on http://localhost:${port}`)
  })
}

for (const [port, seed] of Object.entries(MACHINES)) startMachine(Number(port), seed)

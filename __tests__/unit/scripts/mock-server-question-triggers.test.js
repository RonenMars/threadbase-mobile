/**
 * The mock server's question-card triggers.
 *
 * A permission gate is drawn by Claude and scraped from the PTY by the
 * streamer, so nothing a Maestro flow can do makes one appear. Without these
 * routes the whole card lifecycle — every phase, every exit — is unreachable
 * from e2e, which is why #808 has no flows yet.
 *
 * These check the wire shape the app actually parses, because a trigger that
 * broadcasts a subtly wrong frame produces "the card never showed" and looks
 * like a client bug.
 */
const { spawn } = require('child_process')
const path = require('path')
const WebSocket = require('ws')

const SERVER = path.join(__dirname, '..', '..', '..', 'e2e', 'mock-server.js')
const PORT = 7091
const BASE = `http://127.0.0.1:${PORT}`

let proc

// The test-control routes sit behind the same bearer check as everything else,
// so a flow driving them needs the key it already paired with. Any non-empty
// token is accepted except the fixed bad one the auth flows use.
function post(route, body) {
  return fetch(`${BASE}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' },
    body: JSON.stringify(body ?? {}),
  })
}

/** Resolves with the first frame whose type matches, so unrelated hub traffic
 *  (session_list, cache_ready) can't be mistaken for the frame under test. */
function nextFrame(ws, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${type} frame within 3s`)), 3000)
    ws.on('message', (raw) => {
      const frame = JSON.parse(raw.toString())
      if (frame.type !== type) return
      clearTimeout(timer)
      resolve(frame)
    })
  })
}

function openSocket() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?key=test`)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

beforeAll(async () => {
  proc = spawn('node', [SERVER], { env: { ...process.env, MOCK_PORTS: String(PORT) }, stdio: 'ignore' })
  const deadline = Date.now() + 10000
  for (;;) {
    try {
      await fetch(`${BASE}/api/info`)
      return
    } catch {
      if (Date.now() > deadline) throw new Error('mock server did not start')
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}, 20000)

afterAll(() => proc?.kill())

describe('POST /__test__/gate', () => {
  it('broadcasts a permission frame the app can parse', async () => {
    const ws = await openSocket()
    const frame = nextFrame(ws, 'permission')
    await post('/__test__/gate', { sessionId: 'sess-1' })

    const gate = await frame
    expect(gate.sessionId).toBe('sess-1')
    expect(typeof gate.prompt).toBe('string')
    expect(Array.isArray(gate.options)).toBe(true)
    expect(gate.options.length).toBeGreaterThan(1)
    // Every option needs a numeric index: the client falls back to `${index}\r`
    // when the gate carries no answerKeys, so an option without one is
    // unanswerable on the keystroke path.
    for (const option of gate.options) {
      expect(typeof option.index).toBe('number')
      expect(typeof option.label).toBe('string')
    }
    ws.close()
  })

  // The key is a function of the content on the real server. A fixture that
  // pins one while overriding the detail describes a gate that cannot exist,
  // and makes two visibly different gates share an identity.
  it('derives a different content key when the detail differs', async () => {
    const ws = await openSocket()
    const first = nextFrame(ws, 'permission')
    await post('/__test__/gate', { detail: 'Bash command\nls' })
    const a = await first

    const ws2 = await openSocket()
    const second = nextFrame(ws2, 'permission')
    await post('/__test__/gate', { detail: 'Edit file\nsrc/index.ts' })
    const b = await second

    expect(a.contentKey).not.toBe(b.contentKey)
    ws.close()
    ws2.close()
  })

  // The old-streamer case: no contentKey at all is what drives the client onto
  // its keystroke fallback, and it is the condition every deployed server met
  // before the validated route shipped.
  it('omits the content key entirely when asked for an old streamer', async () => {
    const ws = await openSocket()
    const frame = nextFrame(ws, 'permission')
    await post('/__test__/gate', { contentKey: null })

    expect(await frame).not.toHaveProperty('contentKey')
    ws.close()
  })

  it('broadcasts permission_cancelled on cancel', async () => {
    const ws = await openSocket()
    const frame = nextFrame(ws, 'permission_cancelled')
    await post('/__test__/gate', { cancel: true, sessionId: 'sess-1' })

    expect((await frame).sessionId).toBe('sess-1')
    ws.close()
  })
})

describe('POST /__test__/question', () => {
  it('broadcasts a structured question carrying its toolUseId', async () => {
    const ws = await openSocket()
    const frame = nextFrame(ws, 'question')
    await post('/__test__/question', { sessionId: 'sess-1', toolUseId: 't-9' })

    const q = await frame
    expect(q.toolUseId).toBe('t-9')
    expect(q.questions[0].options.length).toBeGreaterThan(1)
    ws.close()
  })

  it('broadcasts question_cancelled naming the same toolUseId', async () => {
    const ws = await openSocket()
    const frame = nextFrame(ws, 'question_cancelled')
    await post('/__test__/question', { cancel: true, toolUseId: 't-9' })

    expect((await frame).toolUseId).toBe('t-9')
    ws.close()
  })
})

describe('POST /api/sessions/:id/permission/answer', () => {
  it('accepts a content key and an option position', async () => {
    const res = await post('/api/sessions/sess-1/permission/answer', { contentKey: 'k', optionIndex: 0 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects a body missing the content key, the way the real route does', async () => {
    const res = await post('/api/sessions/sess-1/permission/answer', { optionIndex: 0 })
    expect(res.status).toBe(400)
    expect((await res.json()).reason).toMatch(/contentKey/)
  })

  it('serves an armed 409 once, then goes back to accepting', async () => {
    await post('/__test__/answer-reply', { status: 409, reason: 'gate_mismatch' })

    const rejected = await post('/api/sessions/sess-1/permission/answer', { contentKey: 'k', optionIndex: 0 })
    expect(rejected.status).toBe(409)
    expect(await rejected.json()).toEqual({ ok: false, reason: 'gate_mismatch' })

    // One-shot on purpose: a sticky rejection would make every later tap in the
    // same flow fail for a reason the flow never asked for.
    const accepted = await post('/api/sessions/sess-1/permission/answer', { contentKey: 'k', optionIndex: 0 })
    expect(accepted.status).toBe(200)
  })

  // Mirrors the real server: only gate_closed is accompanied by a broadcast.
  // The other two leave a live gate on screen for every other client watching
  // the session, so the reason code is the only thing that clears the card.
  it('broadcasts permission_cancelled for gate_closed but not for gate_mismatch', async () => {
    const ws = await openSocket()
    const cancelled = nextFrame(ws, 'permission_cancelled')

    await post('/__test__/answer-reply', { status: 409, reason: 'gate_mismatch' })
    await post('/api/sessions/sess-1/permission/answer', { contentKey: 'k', optionIndex: 0 })
    const sawEarly = await Promise.race([
      cancelled.then(() => true),
      new Promise((r) => setTimeout(() => r(false), 400)),
    ])
    expect(sawEarly).toBe(false)

    await post('/__test__/answer-reply', { status: 409, reason: 'gate_closed' })
    await post('/api/sessions/sess-1/permission/answer', { contentKey: 'k', optionIndex: 0 })
    expect((await cancelled).type).toBe('permission_cancelled')
    ws.close()
  })
})

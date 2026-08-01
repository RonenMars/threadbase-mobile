import {
  sanitize,
  sanitizeEvent,
  sanitizeBreadcrumb,
  normalizeError,
  scrubString,
  scrubStack,
  valueLooksSensitive,
  REDACTED,
  REDACTED_CIRCULAR,
  MAX_STRING_LENGTH,
  MAX_TOTAL_SERIALIZED,
} from '@/services/sanitize'

/**
 * These strings represent every category the privacy spec forbids from leaving
 * the device. Each test asserts the serialized sanitizer output does not
 * contain the raw secret substring.
 */
const LEAKS = {
  apiKey: 'tb_live_9f8a7b6c5d4e3f2a1b0c',
  bearer: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456ghi789',
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoicm9uZW4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  serverUrl: 'https://mymachine.tunnel.example.com:8443/api/sessions?key=secret123',
  wsUrl: 'wss://10.0.0.5:8766/ws?key=tb_live_9f8a7b6c5d4e3f2a1b0c',
  absPath: '/Users/ronen/Desktop/dev/secret-project/src/index.ts',
  homePath: '~/Desktop/dev/secret-project/.env',
  winPath: 'C:\\Users\\ronen\\projects\\secret\\main.rs',
  ip: '192.168.1.42',
  email: 'ronenmars@gmail.com',
  hostname: 'my-macbook-pro.local',
  prompt: 'Refactor the auth module and remove the hardcoded password hunter2',
  terminal: '$ cat ~/.ssh/id_rsa\n-----BEGIN OPENSSH PRIVATE KEY-----',
  sessionName: 'Fix the billing bug for ACME Corp',
  repoName: 'acme-internal-billing',
  ghToken: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
}

/**
 * Categories with a detectable VALUE shape — the sanitizer must remove these
 * wherever they appear, under any key. (Free-form prose like prompts and
 * session names has no shape and is defended by key-name + allowlist layers.)
 */
const SHAPE_DETECTABLE: readonly (keyof typeof LEAKS)[] = [
  'apiKey', 'bearer', 'jwt', 'serverUrl', 'wsUrl',
  'absPath', 'homePath', 'winPath', 'ip', 'email', 'ghToken',
]

function serialized(value: unknown): string {
  return JSON.stringify(sanitize(value))
}

function assertNoLeaks(output: string) {
  for (const name of SHAPE_DETECTABLE) {
    const secret = LEAKS[name]
    expect(output.includes(secret)).toBe(false)
    if (output.includes(secret)) {
      throw new Error(`Leaked ${name}: ${secret}`)
    }
  }
}

describe('sanitize — generic value scrubbing', () => {
  it('preserves safe scalar metadata', () => {
    const input = {
      appVersion: '1.0.0',
      buildNumber: '162',
      platform: 'ios',
      osVersion: '18.2',
      serverCount: 3,
      connected: true,
      elapsedMs: 4200,
    }
    const out = sanitize(input) as Record<string, unknown>
    expect(out.appVersion).toBe('1.0.0')
    expect(out.buildNumber).toBe('162')
    expect(out.platform).toBe('ios')
    expect(out.serverCount).toBe(3)
    expect(out.connected).toBe(true)
    expect(out.elapsedMs).toBe(4200)
  })

  it('redacts values under sensitive key names', () => {
    const out = sanitize({
      apiKey: 'anything',
      token: 'anything',
      password: 'anything',
      authorization: 'Bearer x',
      serverUrl: LEAKS.serverUrl,
      projectPath: LEAKS.absPath,
      sessionName: LEAKS.sessionName,
      repoName: LEAKS.repoName,
      machineName: LEAKS.hostname,
      deviceName: 'Ronen’s iPhone',
      email: LEAKS.email,
    }) as Record<string, unknown>
    expect(out.apiKey).toBe(REDACTED)
    expect(out.token).toBe(REDACTED)
    expect(out.password).toBe(REDACTED)
    expect(out.authorization).toBe(REDACTED)
    expect(out.serverUrl).toBe(REDACTED)
    expect(out.projectPath).toBe(REDACTED)
    expect(out.sessionName).toBe(REDACTED)
    expect(out.repoName).toBe(REDACTED)
    expect(out.machineName).toBe(REDACTED)
    expect(out.deviceName).toBe(REDACTED)
    expect(out.email).toBe(REDACTED)
  })

  it('redacts secret/PII VALUES even under innocuous key names', () => {
    const out = sanitize({
      note: LEAKS.jwt,
      data: LEAKS.bearer,
      value: LEAKS.apiKey,
      text: LEAKS.serverUrl,
      detail: LEAKS.email,
      info: LEAKS.absPath,
      thing: LEAKS.ghToken,
    }) as Record<string, unknown>
    expect(out.note).toBe(REDACTED)
    expect(out.data).toBe(REDACTED)
    expect(out.value).toBe(REDACTED)
    expect(out.text).toBe(REDACTED)
    expect(out.detail).toBe(REDACTED)
    expect(out.info).toBe(REDACTED)
    expect(out.thing).toBe(REDACTED)
  })

  it('does not leak secret/URL/path categories through nested structures', () => {
    // Note: value-shape detection catches secrets, URLs, paths, IPs, and emails
    // anywhere. Free-form natural-language content (prompts, session names) has
    // no detectable shape and is defended by the ALLOWLIST layer (sanitizeEvent)
    // plus content-key-name matching — see the sanitizeEvent tests below.
    const input = {
      level1: {
        harmless: 'ok',
        level2: {
          creds: LEAKS.apiKey,
          moreArr: [LEAKS.jwt, LEAKS.serverUrl, { filePath: LEAKS.absPath }],
        },
      },
      list: [LEAKS.wsUrl, LEAKS.homePath, LEAKS.ip, LEAKS.email, LEAKS.ghToken],
    }
    const out = serialized(input)
    for (const secret of [
      LEAKS.apiKey, LEAKS.jwt, LEAKS.serverUrl, LEAKS.absPath,
      LEAKS.wsUrl, LEAKS.homePath, LEAKS.ip, LEAKS.email, LEAKS.ghToken,
    ]) {
      expect(out.includes(secret)).toBe(false)
    }
  })

  it('redacts free-form content only via a content-named key (documents the boundary)', () => {
    // A prompt under a content-named key is redacted…
    expect((sanitize({ draftPrompt: LEAKS.prompt }) as Record<string, unknown>).draftPrompt).toBe(REDACTED)
    expect((sanitize({ sessionName: LEAKS.sessionName }) as Record<string, unknown>).sessionName).toBe(REDACTED)
    // …but the same prose under an arbitrary key survives (no detectable shape).
    // This is why callers MUST use the allowlist for anything Sentry-bound.
    expect((sanitize({ x: LEAKS.prompt }) as Record<string, unknown>).x).toContain('Refactor')
  })

  it('handles arrays of sensitive strings', () => {
    const out = serialized([LEAKS.apiKey, LEAKS.serverUrl, LEAKS.ip, 'safe'])
    assertNoLeaks(out)
    expect(out.includes('safe')).toBe(true)
  })

  it('truncates over-long strings', () => {
    const long = 'a'.repeat(MAX_STRING_LENGTH + 500)
    const out = sanitize({ note: long }) as Record<string, string>
    expect(out.note.length).toBeLessThanOrEqual(MAX_STRING_LENGTH + '[truncated]'.length)
    expect(out.note.endsWith('[truncated]')).toBe(true)
  })

  it('enforces a total serialized-size ceiling', () => {
    const big: Record<string, string> = {}
    for (let i = 0; i < 5000; i++) big['k' + i] = 'x'.repeat(50)
    const out = sanitize(big)
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(MAX_TOTAL_SERIALIZED + 64)
  })
})

describe('sanitize — circular & malformed', () => {
  it('does not throw on circular references', () => {
    const a: Record<string, unknown> = { name: 'a' }
    const b: Record<string, unknown> = { name: 'b', a }
    a.b = b
    a.self = a
    expect(() => sanitize(a)).not.toThrow()
    const out = JSON.stringify(sanitize(a))
    expect(out.includes(REDACTED_CIRCULAR)).toBe(true)
  })

  it('handles circular arrays', () => {
    const arr: unknown[] = [1, 2]
    arr.push(arr)
    expect(() => sanitize(arr)).not.toThrow()
  })

  it('tames non-serializable values (bigint, symbol, function)', () => {
    const out = sanitize({
      big: BigInt(10),
      sym: Symbol('x'),
      fn: () => 42,
      nan: NaN,
      inf: Infinity,
    }) as Record<string, unknown>
    expect(out.big).toBe(REDACTED)
    expect(out.sym).toBe(REDACTED)
    expect(out.fn).toBe(REDACTED)
    expect(out.nan).toBeNull()
    expect(out.inf).toBeNull()
    // Result must be JSON-serializable
    expect(() => JSON.stringify(out)).not.toThrow()
  })

  it('coarsens Date to date-only (no precise timestamp)', () => {
    const out = sanitize({ when: new Date('2026-07-12T13:45:31.123Z') }) as Record<string, string>
    expect(out.when).toBe('2026-07-12')
  })

  it('returns a safe value for null/undefined/primitive inputs', () => {
    expect(sanitize(null)).toBeNull()
    expect(sanitize(undefined)).toBeUndefined()
    expect(sanitize(42)).toBe(42)
    expect(sanitize('safe')).toBe('safe')
  })
})

describe('normalizeError', () => {
  it('normalizes a real Error and scrubs its message', () => {
    const err = new Error(`Failed to reach ${LEAKS.serverUrl}`)
    const out = normalizeError(err)
    expect(out.name).toBe('Error')
    expect(out.message).toBe(REDACTED)
  })

  it('keeps a safe error message intact', () => {
    const out = normalizeError(new TypeError('Cannot read property foo of undefined'))
    expect(out.name).toBe('TypeError')
    expect(out.message).toContain('Cannot read property')
  })

  it('handles string throws', () => {
    expect(normalizeError('boom').message).toBe('boom')
    expect(normalizeError(LEAKS.apiKey).message).toBe(REDACTED)
  })

  it('handles non-error objects and nullish throws', () => {
    expect(normalizeError({ message: 'x', name: 'Custom' }).name).toBe('Custom')
    expect(normalizeError(null).message).toBe(REDACTED)
    expect(normalizeError(undefined).message).toBe(REDACTED)
  })

  it('scrubs the stack of URLs and home paths', () => {
    const err = new Error('safe message')
    err.stack = `Error: safe message\n    at foo (${LEAKS.absPath}:10:5)\n    at bar (${LEAKS.homePath}:1:1)`
    const out = normalizeError(err)
    expect(out.stack).toBeDefined()
    expect(out.stack!.includes('/Users/ronen/Desktop/dev/secret-project')).toBe(false)
    expect(out.stack!.includes('~/Desktop/dev/secret-project')).toBe(false)
  })
})

describe('scrubString / valueLooksSensitive', () => {
  it('flags every forbidden category', () => {
    expect(valueLooksSensitive(LEAKS.apiKey)).toBe(true)
    expect(valueLooksSensitive(LEAKS.jwt)).toBe(true)
    expect(valueLooksSensitive(LEAKS.bearer)).toBe(true)
    expect(valueLooksSensitive(LEAKS.serverUrl)).toBe(true)
    expect(valueLooksSensitive(LEAKS.wsUrl)).toBe(true)
    expect(valueLooksSensitive(LEAKS.absPath)).toBe(true)
    expect(valueLooksSensitive(LEAKS.homePath)).toBe(true)
    expect(valueLooksSensitive(LEAKS.winPath)).toBe(true)
    expect(valueLooksSensitive(LEAKS.ip)).toBe(true)
    expect(valueLooksSensitive(LEAKS.email)).toBe(true)
    expect(valueLooksSensitive(LEAKS.ghToken)).toBe(true)
  })

  it('does not flag ordinary safe strings', () => {
    expect(valueLooksSensitive('ios')).toBe(false)
    expect(valueLooksSensitive('1.0.0')).toBe(false)
    expect(valueLooksSensitive('connected')).toBe(false)
    expect(valueLooksSensitive('TypeError')).toBe(false)
    expect(scrubString('connection_failed')).toBe('connection_failed')
  })

  it('does not flag safe enum tokens, filenames, or version strings as hostnames', () => {
    // These must survive — they are the vocabulary of our own instrumentation.
    expect(valueLooksSensitive('app.lifecycle')).toBe(false)
    expect(valueLooksSensitive('connection_started')).toBe(false)
    expect(valueLooksSensitive('websocket_disconnected')).toBe(false)
    expect(valueLooksSensitive('1.0.0')).toBe(false)
    expect(valueLooksSensitive('18.2')).toBe(false)
    expect(valueLooksSensitive('render_error_boundary')).toBe(false)
  })

  it('flags bare hostnames (no scheme) in free-form strings', () => {
    expect(valueLooksSensitive('prod.tunnel.example.com')).toBe(true)
    expect(valueLooksSensitive('my-macbook.local')).toBe(true)
    expect(valueLooksSensitive('Failed to reach relay.threadbase.dev now')).toBe(true)
  })
})

describe('sanitizeBreadcrumb', () => {
  it('drops http/xhr/fetch/navigation/console breadcrumbs entirely', () => {
    expect(sanitizeBreadcrumb({ category: 'http', data: { url: LEAKS.serverUrl } })).toBeNull()
    expect(sanitizeBreadcrumb({ category: 'xhr', data: { url: LEAKS.wsUrl } })).toBeNull()
    expect(sanitizeBreadcrumb({ category: 'fetch' })).toBeNull()
    expect(sanitizeBreadcrumb({ category: 'navigation', data: { to: '/session/secret' } })).toBeNull()
    expect(sanitizeBreadcrumb({ category: 'ui.click', message: LEAKS.sessionName })).toBeNull()
    expect(sanitizeBreadcrumb({ category: 'console', message: 'log line' })).toBeNull()
  })

  it('keeps a generic app breadcrumb but scrubs its content', () => {
    const out = sanitizeBreadcrumb({
      category: 'app.lifecycle',
      level: 'info',
      type: 'default',
      message: 'app_resumed',
      data: { count: 3, url: LEAKS.serverUrl },
    })
    expect(out).not.toBeNull()
    expect(out!.category).toBe('app.lifecycle')
    expect(out!.message).toBe('app_resumed')
    const s = JSON.stringify(out)
    assertNoLeaks(s)
  })

  it('drops a breadcrumb message that looks sensitive', () => {
    const out = sanitizeBreadcrumb({ category: 'app', message: LEAKS.prompt })
    expect(out!.message).toBeUndefined()
  })

  it('keeps only enum-safe/scalar breadcrumb data, dropping free-form strings', () => {
    const out = sanitizeBreadcrumb({
      category: 'app',
      message: 'server_added',
      data: {
        count: 3,
        ok: true,
        mode: 'local', // enum-safe string — kept
        note: 'this is free-form user text that could be anything', // dropped
        title: LEAKS.sessionName, // sensitive key — dropped
        nested: { deep: LEAKS.prompt }, // objects dropped
      },
    })
    expect(out!.data).toEqual({ count: 3, ok: true, mode: 'local' })
    assertNoLeaks(JSON.stringify(out))
  })

  it('never throws on garbage', () => {
    expect(sanitizeBreadcrumb(null)).toBeNull()
    expect(sanitizeBreadcrumb(undefined)).toBeNull()
    // @ts-expect-error intentional bad input
    expect(sanitizeBreadcrumb(42)).toBeNull()
  })
})

describe('sanitizeEvent — allowlist', () => {
  function baseEvent(): Record<string, unknown> {
    return {
      event_id: 'abc123',
      timestamp: 1720000000,
      platform: 'javascript',
      level: 'error',
      environment: 'production',
      release: 'threadbase-mobile@1.0.0+162',
      dist: '162',
      exception: {
        values: [
          {
            type: 'Error',
            value: `Boom at ${LEAKS.serverUrl}`,
            stacktrace: {
              frames: [
                {
                  function: 'doThing',
                  filename: LEAKS.absPath,
                  lineno: 10,
                  colno: 5,
                  in_app: true,
                  vars: { apiKey: LEAKS.apiKey, prompt: LEAKS.prompt },
                  context_line: 'const secret = "tb_live_xxx"',
                },
              ],
            },
          },
        ],
      },
      tags: { 'app.version': '1.0.0', platform: 'ios', 'server.url': LEAKS.serverUrl },
      user: { id: 'anon-uuid-1234', email: LEAKS.email, ip_address: LEAKS.ip, username: 'ronen' },
      contexts: {
        app: { app_version: '1.0.0', app_build: '162' },
        os: { name: 'iOS', version: '18.2' },
        device: { simulator: false, name: 'Ronen’s iPhone', memory_size: 4096 },
      },
      // Fields that must be dropped wholesale:
      request: { url: LEAKS.serverUrl, headers: { Authorization: LEAKS.bearer } },
      server_name: LEAKS.hostname,
      extra: { draft: LEAKS.prompt, cwd: LEAKS.absPath },
      breadcrumbs: [
        { category: 'http', data: { url: LEAKS.wsUrl } },
        { category: 'app', message: 'connection_started' },
      ],
    }
  }

  it('drops non-allowlisted top-level keys (request/server_name/extra)', () => {
    const out = sanitizeEvent(baseEvent()) as Record<string, unknown>
    expect(out.request).toBeUndefined()
    expect(out.server_name).toBeUndefined()
    expect(out.extra).toBeUndefined()
  })

  it('scrubs exception message and drops frame vars/context_line', () => {
    const out = sanitizeEvent(baseEvent()) as Record<string, unknown>
    const exc = (out.exception as { values: Record<string, unknown>[] }).values[0]
    expect(exc.value).toBe(REDACTED)
    const frame = (exc.stacktrace as { frames: Record<string, unknown>[] }).frames[0]
    expect(frame.function).toBe('doThing')
    expect(frame.vars).toBeUndefined()
    expect(frame.context_line).toBeUndefined()
    expect(frame.lineno).toBe(10)
  })

  it('strips user to id only, dropping email/ip/username', () => {
    const out = sanitizeEvent(baseEvent()) as Record<string, unknown>
    expect(out.user).toEqual({ id: 'anon-uuid-1234', ip_address: null })
  })

  it('sends ip_address as an explicit null rather than omitting it', () => {
    // Not the same thing: Sentry backfills an *absent* ip_address from the
    // connection the event arrived on and derives a city-level user.geo from it,
    // which the privacy policy does not list among a crash report's contents.
    // An explicit null tells Sentry not to infer. Deleting this assertion would
    // silently reintroduce coarse location data.
    const out = sanitizeEvent(baseEvent()) as Record<string, unknown>
    const user = out.user as Record<string, unknown>
    expect('ip_address' in user).toBe(true)
    expect(user.ip_address).toBeNull()
  })

  it('drops sensitive tags but keeps safe ones', () => {
    const out = sanitizeEvent(baseEvent()) as Record<string, unknown>
    const tags = out.tags as Record<string, string>
    expect(tags.platform).toBe('ios')
    expect(tags['server.url']).toBeUndefined()
  })

  it('keeps only allowlisted context sub-fields', () => {
    const out = sanitizeEvent(baseEvent()) as Record<string, unknown>
    const contexts = out.contexts as Record<string, Record<string, unknown>>
    expect(contexts.app.app_version).toBe('1.0.0')
    expect(contexts.os.version).toBe('18.2')
    expect(contexts.device.simulator).toBe(false)
    expect(contexts.device.name).toBeUndefined()
    expect(contexts.device.memory_size).toBeUndefined()
  })

  it('filters breadcrumbs (drops http, keeps app)', () => {
    const out = sanitizeEvent(baseEvent()) as Record<string, unknown>
    const crumbs = out.breadcrumbs as Record<string, unknown>[]
    expect(crumbs).toHaveLength(1)
    expect(crumbs[0].message).toBe('connection_started')
  })

  it('produces an event with NO forbidden substrings anywhere', () => {
    const out = sanitizeEvent(baseEvent())
    assertNoLeaks(JSON.stringify(out))
  })

  it('returns null for garbage / unsanitizable input', () => {
    expect(sanitizeEvent(null)).toBeNull()
    expect(sanitizeEvent(undefined)).toBeNull()
    // @ts-expect-error intentional bad input
    expect(sanitizeEvent(42)).toBeNull()
  })
})

describe('sanitizeEvent — user feedback carve-out', () => {
  function feedbackEvent(): Record<string, unknown> {
    return {
      type: 'feedback',
      event_id: 'fb1',
      level: 'info',
      platform: 'javascript',
      contexts: {
        feedback: {
          message: 'The tree view feels sluggish when I expand a big project.',
          contact_email: 'user@example.com',
          associated_event_id: 'abc123def456',
        },
      },
      // Fields that must still be stripped even on a feedback event:
      request: { url: LEAKS.serverUrl },
      server_name: LEAKS.hostname,
      extra: { draft: LEAKS.prompt },
    }
  }

  it('keeps the user-authored message and reply email (explicitly submitted)', () => {
    const out = sanitizeEvent(feedbackEvent()) as Record<string, unknown>
    const fb = (out.contexts as { feedback: Record<string, unknown> }).feedback
    expect(fb.message).toBe('The tree view feels sluggish when I expand a big project.')
    expect(fb.contact_email).toBe('user@example.com')
    expect(fb.associated_event_id).toBe('abc123def456')
    expect(fb.source).toBe('app.feedback_form')
  })

  it('still strips request/server_name/extra from a feedback event', () => {
    const out = sanitizeEvent(feedbackEvent()) as Record<string, unknown>
    expect(out.request).toBeUndefined()
    expect(out.server_name).toBeUndefined()
    expect(out.extra).toBeUndefined()
    const s = JSON.stringify(out)
    expect(s.includes('tunnel.example.com')).toBe(false)
    expect(s.includes(LEAKS.prompt)).toBe(false)
  })

  it('drops a feedback event with an empty message', () => {
    const e = feedbackEvent()
    ;(e.contexts as { feedback: { message: string } }).feedback.message = '   '
    expect(sanitizeEvent(e)).toBeNull()
  })

  it('caps an overly long feedback message', () => {
    const e = feedbackEvent()
    ;(e.contexts as { feedback: { message: string } }).feedback.message = 'x'.repeat(9000)
    const out = sanitizeEvent(e) as Record<string, unknown>
    const fb = (out.contexts as { feedback: Record<string, string> }).feedback
    expect(fb.message.length).toBeLessThanOrEqual(4000)
  })
})

describe('scrubStack', () => {
  it('redacts urls, home paths, and windows paths while keeping frame shape', () => {
    const stack = [
      'Error: boom',
      `    at foo (${LEAKS.serverUrl}:1:1)`,
      `    at bar (${LEAKS.homePath}:2:2)`,
      `    at baz (${LEAKS.winPath}:3:3)`,
      `    at qux (${LEAKS.absPath}:4:4)`,
    ].join('\n')
    const out = scrubStack(stack)
    expect(out.includes('tunnel.example.com')).toBe(false)
    expect(out.includes('~/Desktop/dev/secret-project')).toBe(false)
    expect(out.includes('C:\\Users\\ronen')).toBe(false)
    expect(out.includes('/Users/ronen/Desktop/dev/secret-project')).toBe(false)
    // Frame function names survive
    expect(out.includes('foo')).toBe(true)
    expect(out.includes('baz')).toBe(true)
  })
})

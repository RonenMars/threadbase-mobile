import { canSetModelEffort } from '@/lib/modelEffortSupport'
import { NetworkError, NotFoundError } from '@/services/api-client'
import { CLAUDE_CODE_PROVIDER, CODEX_CLI_PROVIDER } from '@/constants/providers'
import { MODEL_NAME_RE } from '@/constants/models'

describe('canSetModelEffort', () => {
  it('is true for a live Claude session that reports an effort tier', () => {
    expect(canSetModelEffort({ provider: CLAUDE_CODE_PROVIDER, effort: 'high' })).toBe(true)
  })

  // Absent provider means claude-code across this repo; a positive === test
  // would hide the control on every older server and in the e2e mock.
  it('is true when the provider is absent', () => {
    expect(canSetModelEffort({ provider: undefined, effort: 'medium' })).toBe(true)
  })

  it('is false for a Codex session', () => {
    expect(canSetModelEffort({ provider: CODEX_CLI_PROVIDER, effort: 'high' })).toBe(false)
  })

  // A streamer too old for the PATCH routes never puts `effort` in session state.
  it('is false when the session reports no effort', () => {
    expect(canSetModelEffort({ provider: CLAUDE_CODE_PROVIDER, effort: undefined })).toBe(false)
  })

  it('is false with no session at all', () => {
    expect(canSetModelEffort(undefined)).toBe(false)
    expect(canSetModelEffort(null)).toBe(false)
  })

  it('is false once a write 404s — the route does not exist', () => {
    const session = { provider: CLAUDE_CODE_PROVIDER, effort: 'high' }
    expect(canSetModelEffort(session, [new NotFoundError('/api/sessions/s/model')])).toBe(false)
  })

  it('is false once a write answers 501 UNSUPPORTED_PROVIDER', () => {
    const session = { provider: CLAUDE_CODE_PROVIDER, effort: 'high' }
    const err = new NetworkError('Server returned 501', 'UNSUPPORTED_PROVIDER', undefined, 501)
    expect(canSetModelEffort(session, [err])).toBe(false)
  })

  it('stays true for an ordinary failure such as a 409', () => {
    const session = { provider: CLAUDE_CODE_PROVIDER, effort: 'high' }
    const err = new NetworkError('Server returned 409', 'SESSION_BUSY', undefined, 409)
    expect(canSetModelEffort(session, [err, null])).toBe(true)
  })
})

describe('MODEL_NAME_RE', () => {
  it.each(['sonnet', 'opus', 'claude-opus-4-5', 'Claude.4_5-x'])('accepts %s', (name) => {
    expect(MODEL_NAME_RE.test(name)).toBe(true)
  })

  it.each(['', '-leading-dash', 'has space', 'slash/name', 'a'.repeat(65)])('rejects %s', (name) => {
    expect(MODEL_NAME_RE.test(name)).toBe(false)
  })
})

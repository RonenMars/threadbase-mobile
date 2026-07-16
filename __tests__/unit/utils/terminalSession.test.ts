import { isTerminalSession } from '@/utils/terminalSession'

const base = {
  ptyAttached: false,
  status: 'idle' as string,
  promptCount: 0,
  lastOutput: '',
}

describe('isTerminalSession', () => {
  it('is terminal for a dead-on-arrival session (no pty, idle, 0 prompts, empty output)', () => {
    expect(isTerminalSession(base)).toBe(true)
  })

  it('treats on_hold the same as idle', () => {
    expect(isTerminalSession({ ...base, status: 'on_hold' })).toBe(true)
  })

  it('is terminal for legacy completed/failed regardless of other fields', () => {
    expect(isTerminalSession({ ...base, status: 'completed', ptyAttached: true })).toBe(true)
    expect(isTerminalSession({ ...base, status: 'failed', promptCount: 5, lastOutput: 'x' })).toBe(true)
  })

  it('is NOT terminal when a live PTY is attached', () => {
    expect(isTerminalSession({ ...base, ptyAttached: true })).toBe(false)
  })

  it('is NOT terminal when the session has run a turn (promptCount > 0)', () => {
    expect(isTerminalSession({ ...base, promptCount: 1 })).toBe(false)
  })

  it('is NOT terminal when there is buffered output', () => {
    expect(isTerminalSession({ ...base, lastOutput: 'hello' })).toBe(false)
  })

  it('is NOT terminal while still running', () => {
    expect(isTerminalSession({ ...base, status: 'running' })).toBe(false)
  })
})

import {
  getTerminalChromeFilter,
  isClaudeTerminalChrome,
  isCodexTerminalChrome,
  keepTranscriptLine,
} from '@/lib/terminalChrome'

describe('terminalChrome adapters', () => {
  it('filters Claude Code spinner and banner chrome', () => {
    expect(isClaudeTerminalChrome('Welcome to Claude Code')).toBe(true)
    expect(isClaudeTerminalChrome('· Thinking…')).toBe(true)
    expect(isClaudeTerminalChrome('❯ ship the fix')).toBe(false)
  })

  it('keeps Codex non-chrome lines and drops empty separators', () => {
    expect(isCodexTerminalChrome('────')).toBe(true)
    expect(isCodexTerminalChrome('editing main.ts')).toBe(false)
  })

  it('selects passthrough for unknown providers', () => {
    const filter = getTerminalChromeFilter('mystery-agent')
    expect(keepTranscriptLine('any line', filter)).toBe(true)
  })

  it('raw mode keeps non-empty lines', () => {
    const filter = getTerminalChromeFilter('claude-code', { raw: true })
    expect(keepTranscriptLine('Welcome to Claude Code', filter)).toBe(true)
  })
})

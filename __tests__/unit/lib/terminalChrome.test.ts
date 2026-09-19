import {
  getTerminalChromeFilter,
  isClaudeTerminalChrome,
  isCodexTerminalChrome,
  keepTranscriptLine,
  dropGhostPromptLine,
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

describe('dropGhostPromptLine', () => {
  const ghost = 'add type hints and a docstring'

  it('drops the trailing `❯ <suggestion>` row and nothing else', () => {
    const lines = ['⏺ Done.', '❯ add tests', '⏺ Added.', `❯ ${ghost}`]
    expect(dropGhostPromptLine(lines, ghost)).toEqual(['⏺ Done.', '❯ add tests', '⏺ Added.'])
  })

  it('ignores ANSI around the row', () => {
    expect(dropGhostPromptLine([`\x1b[2m❯ ${ghost}\x1b[0m`], ghost)).toEqual([])
  })

  it('keeps the row unless the text matches exactly', () => {
    const lines = [`❯ ${ghost} please`]
    expect(dropGhostPromptLine(lines, ghost)).toBe(lines)
    expect(dropGhostPromptLine([`❯ ${ghost.slice(0, -1)}`], ghost)).toEqual([`❯ ${ghost.slice(0, -1)}`])
  })

  it('never reaches past the last prompt row to an older message with the same text', () => {
    const lines = [`❯ ${ghost}`, '⏺ Done.', '❯ something else']
    expect(dropGhostPromptLine(lines, ghost)).toBe(lines)
  })

  it('is a no-op without an active suggestion', () => {
    const lines = [`❯ ${ghost}`]
    expect(dropGhostPromptLine(lines, null)).toBe(lines)
    expect(dropGhostPromptLine(lines, undefined)).toBe(lines)
    expect(dropGhostPromptLine(lines, '')).toBe(lines)
  })
})

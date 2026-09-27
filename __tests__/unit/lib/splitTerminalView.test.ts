import { splitTerminalView } from '@/lib/splitTerminalView'
import type { Message } from '@/types/api'

function msg(role: Message['role'], text: string, index: number): Message {
  return {
    id: `conv-${index}`,
    uuid: `uuid-${index}`,
    messageIndex: index,
    role,
    content: [{ type: 'text', text }],
    timestamp: new Date(1_700_000_000_000 + index * 1000).toISOString(),
  }
}

const history: Message[] = [
  msg('user', 'fix the lint errors', 0),
  msg('assistant', 'Done, three files changed.', 1),
  msg('user', 'now run the tests', 2),
]

const prompts = [
  { text: 'fix the lint errors', ts: 1 },
  { text: 'now run the tests', ts: 2 },
]

// Rows as VirtualTerminal.getLines() hands them over: the prompt echo, then
// the turn's output, then Claude's status footer.
const frameWithPrompt = [
  '❯ now run the tests',
  '⏺ Running the suite.',
  '  Ran 1 shell command',
  '✳ Brewing… (1m 1s · ↓ 2.1k tokens)',
]

describe('splitTerminalView', () => {
  it('shows only the transcript when no turn is open', () => {
    const out = splitTerminalView({
      gridLines: frameWithPrompt,
      prompts,
      messages: history,
      turnOpen: false,
    })
    expect(out).toEqual({ transcript: history, live: [], anchor: 'none' })
  })

  it('shows only the transcript before the first prompt', () => {
    const out = splitTerminalView({ gridLines: ['Welcome to Claude Code'], prompts: [], messages: [], turnOpen: true })
    expect(out).toEqual({ transcript: [], live: [], anchor: 'none' })
  })

  it('starts the live region at the prompt row when it is still on screen', () => {
    const out = splitTerminalView({ gridLines: frameWithPrompt, prompts, messages: history, turnOpen: true })
    expect(out.anchor).toBe('prompt-row')
    expect(out.live).toEqual(frameWithPrompt)
    // The JSONL copy of the current prompt is hidden; the screen already shows it.
    expect(out.transcript).toEqual(history.slice(0, 2))
  })

  it('hides the current turn\'s finished items while the prompt row is on screen', () => {
    const messages = [...history, msg('assistant', 'All 6 pass.', 3)]
    const out = splitTerminalView({
      gridLines: [...frameWithPrompt, '⏺ All 6 pass.'],
      prompts,
      messages,
      turnOpen: true,
    })
    expect(out.anchor).toBe('prompt-row')
    expect(out.transcript).toEqual(history.slice(0, 2))
  })

  it('keeps every message when the JSONL has not recorded the prompt yet', () => {
    const out = splitTerminalView({
      gridLines: frameWithPrompt,
      prompts,
      messages: history.slice(0, 2),
      turnOpen: true,
    })
    expect(out.anchor).toBe('prompt-row')
    expect(out.transcript).toEqual(history.slice(0, 2))
  })

  it('falls back to the whole frame after a clear removed the prompt row', () => {
    const afterClear = ['  211 +    rmSync(agentDir, { recursive: true })', '✳ Brewing… (7m 28s)']
    const messages = [...history, msg('assistant', 'Now run the test suite.', 3)]
    const out = splitTerminalView({ gridLines: afterClear, prompts, messages, turnOpen: true })
    expect(out).toEqual({ transcript: messages, live: afterClear, anchor: 'frame' })
  })

  it('anchors on the latest prompt when the same text was sent twice', () => {
    const twice = [...prompts, { text: 'now run the tests', ts: 3 }]
    const messages = [...history, msg('assistant', 'Failed.', 3), msg('user', 'now run the tests', 4)]
    const grid = ['❯ now run the tests', '⏺ Failed.', '❯ now run the tests', '⏺ Retrying.']
    const out = splitTerminalView({ gridLines: grid, prompts: twice, messages, turnOpen: true })
    expect(out.live).toEqual(['❯ now run the tests', '⏺ Retrying.'])
    expect(out.transcript).toEqual(messages.slice(0, 4))
  })

  it('matches a pasted prompt against its unwrapped JSONL record', () => {
    const pasted = '<pasted_content id="1">\nhello from paste\n</pasted_content id="1">'
    const messages = [msg('user', pasted, 0)]
    const out = splitTerminalView({
      gridLines: ['❯ hello from paste', '⏺ Hi.'],
      prompts: [{ text: 'hello from paste', ts: 1 }],
      messages,
      turnOpen: true,
    })
    expect(out.anchor).toBe('prompt-row')
    expect(out.transcript).toEqual([])
  })

  it('ignores ANSI styling and the ASCII prompt glyph on the grid row', () => {
    const out = splitTerminalView({
      gridLines: ['\x1b[1m> now run the tests\x1b[0m', 'output'],
      prompts,
      messages: history,
      turnOpen: true,
    })
    expect(out.anchor).toBe('prompt-row')
  })

  it('does not treat a numbered picker row as the prompt', () => {
    const out = splitTerminalView({
      gridLines: ['❯ 1. now run the tests', 'Enter to confirm'],
      prompts,
      messages: history,
      turnOpen: true,
    })
    expect(out.anchor).toBe('frame')
  })
})

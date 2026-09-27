import type { Message } from '@/types/api'
import { stripAnsi } from '@/utils/stripAnsi'
import { cliPromptText } from '@/lib/cliPromptText'

/**
 * The join between the conversation transcript and the rendered PTY grid.
 * See docs/design/terminal-transcript-scrollback.md → "The join rule".
 *
 * Claude Code wipes its scrollback (`ESC[2J ESC[3J`) whenever a live frame
 * taller than the viewport changes above it, so the grid only ever holds what
 * was drawn since the last clear. The transcript has every finished item but
 * lags the screen by one in-flight item. This function decides which source
 * shows which rows so nothing is dropped between them.
 */

export interface TerminalPrompt {
  text: string
  ts: number
}

export interface SplitTerminalViewInput {
  /** Rendered grid rows since the last clear (`VirtualTerminal.getLines()`). */
  gridLines: string[]
  /** Prompts the streamer submitted to the PTY, oldest first. */
  prompts: TerminalPrompt[]
  /** Merged transcript, history then live, in display order. */
  messages: Message[]
  /** `running`, or a permission/question card is pending. */
  turnOpen: boolean
}

export type SplitAnchor = 'prompt-row' | 'frame' | 'none'

export interface SplitTerminalView {
  /** Transcript messages to render above the live region. */
  transcript: Message[]
  /** Grid rows to render below the transcript. Empty when no turn is open. */
  live: string[]
  /**
   * How the split was found. `prompt-row`: the current prompt is still on
   * screen and the live region starts there. `frame`: a clear removed it, so
   * the live region is the whole frame and may repeat one finished item.
   * `none`: no turn is open.
   */
  anchor: SplitAnchor
}

// Same shape TerminalOutput uses to recognise a user-owned row, minus the
// picker-row exclusion: a picker row can never equal a submitted prompt.
const USER_ROW_RE = /^[❯›>]\s(.*)$/

function userRowText(line: string): string | null {
  const m = stripAnsi(line).trim().match(USER_ROW_RE)
  return m ? m[1].trim() : null
}

function messageText(m: Message): string {
  return m.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

function lastIndex<T>(items: T[], pred: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (pred(items[i])) return i
  }
  return -1
}

export function splitTerminalView({
  gridLines,
  prompts,
  messages,
  turnOpen,
}: SplitTerminalViewInput): SplitTerminalView {
  const current = prompts.length > 0 ? prompts[prompts.length - 1].text.trim() : ''
  if (!turnOpen || current === '') {
    return { transcript: messages, live: [], anchor: 'none' }
  }

  const promptRow = lastIndex(gridLines, (line) => userRowText(line) === current)
  if (promptRow === -1) {
    return { transcript: messages, live: gridLines, anchor: 'frame' }
  }

  // The transcript stops before the JSONL copy of the current prompt. When the
  // JSONL has not recorded it yet (the file lags the submit), every message is
  // older than the prompt and all of them stay.
  const promptMessage = lastIndex(
    messages,
    (m) => m.role === 'user' && cliPromptText(messageText(m)).trim() === current,
  )
  const transcript = promptMessage === -1 ? messages : messages.slice(0, promptMessage)
  return { transcript, live: gridLines.slice(promptRow), anchor: 'prompt-row' }
}

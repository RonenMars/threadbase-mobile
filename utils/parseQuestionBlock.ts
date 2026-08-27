import { stripAnsi } from '@/utils/stripAnsi'

export interface QuestionOption {
  label: string
  description?: string
  preview?: string
  /** Prompt-contract only: the opaque id the answer carries instead of the label. */
  optionId?: string
}
export interface QuestionItem {
  question: string
  header?: string
  /** Prompt-contract only: the opaque id the answer is keyed on. */
  questionId?: string
  /** Permission-gate only: descriptive block (tool + command + action) shown above the question. */
  detail?: string
  multiSelect: boolean
  options: QuestionOption[]
}
export interface QuestionBlock {
  source: 'structured' | 'pty' | 'permission' | 'prompt'
  toolUseId?: string
  /** Prompt-contract only: server-owned occurrence id, echoed on the answer. */
  promptId?: string
  /** Prompt-contract only: the revision this block was built from, echoed on the answer. */
  promptRevision?: number
  /**
   * Prompt-contract only: set when the prompt needs an answer this build cannot
   * send — a multi-question form, a multi-select or free-text question, or an
   * input mode it does not know. The card renders no options and says so; no
   * keystrokes are ever synthesized for it.
   */
  unsupportedShape?: 'form' | 'multi' | 'text' | 'unknown'
  questions: QuestionItem[]
  /** PTY-scrape only: index of the ❯ cursor row among options of questions[0] */
  selectedIndex?: number
  /** PTY-scrape only: index in source lines[] where the question line sits */
  questionLineIndex?: number
  /**
   * Permission-gate only: the REAL on-screen option numbers (not 1-based),
   * positionally aligned with questions[0].options. Selecting option i is
   * answered by sending `${permissionIndices[i]}\r` via the keystroke route,
   * unless permissionAnswerKeys[i] says otherwise.
   */
  permissionIndices?: number[]
  /**
   * Permission-gate only: literal keystrokes per option, positionally aligned
   * with permissionIndices. Authoritative when present — a Codex EXEC approval
   * shows "1. yes" but is answered by `y`, so the on-screen number would be the
   * wrong bytes. Sparse: OSC-777 gates leave every entry undefined and fall
   * back to the index.
   */
  permissionAnswerKeys?: (string | undefined)[]
  /**
   * Permission-gate only: the server's opaque content key for this gate, echoed
   * back on the validated answer route. Absent when the streamer is too old to
   * send one, which is also the signal that the route does not exist.
   */
  permissionContentKey?: string
  /**
   * Permission-gate only: the server's per-instance id for this gate, echoed
   * back next to permissionContentKey. Absent on streamers that predate it.
   */
  permissionGateId?: string
}

const QUESTION_RE = /^\?\s+(.+)$/
const SELECTED_OPTION_RE = /^❯\s+(.+)$/
// Format 2 entry: the ❯ cursor line must be numbered ("❯ 1. …"). A bare
// "❯ <text>" line is the user's submitted message in the transcript (the VT
// chrome filter deliberately lets those through) — never a menu cursor.
const NUMBERED_SELECTED_OPTION_RE = /^❯\s+\d+\.\s+/
// Accept 2–3 leading spaces (aligned numbered lists indent to 3). 4+ = tool output.
const UNSELECTED_OPTION_RE = /^ {2,3}(\S.*)$/
// Strip leading "1. " / "2. " numbering from option text
const NUMBERED_PREFIX_RE = /^\d+\.\s+/

// Format 3 (AskUserQuestion menu): a "?"-suffixed question with numbered
// options and Tab/Arrow navigation — there may be NO ❯ cursor at all, so
// neither Format 1 (needs "? " at line start) nor Format 2 (needs a ❯ line)
// matches. A numbered option row, optionally cursor-marked: "❯ 1. macOS",
// "  2. iOS". The box gutter is stripped before matching.
const QUESTION_SUFFIX_RE = /\?$/
const NUMBERED_OPTION_RE = /^(❯)?\s*(\d+)\.\s+(.+?)$/

// Permission-gate option labels (Yes / No …). A gate is handled by the
// structured `permission` WS event, not as a radio QuestionCard — reject it
// here so it never renders as a fake picker.
const PERMISSION_OPTION_RE = /^(Yes|No)\b/i

function stripNumberedPrefix(s: string): string {
  return s.replace(NUMBERED_PREFIX_RE, '')
}

// Strip leading/trailing box-drawing gutters ("│ … │") and surrounding
// whitespace so a menu drawn inside a box parses like an unboxed one.
function stripBoxGutter(s: string): string {
  return s
    .replace(/^\s*[│|]\s?/, '')
    .replace(/\s*[│|]\s*$/, '')
    .trim()
}

// Detect the structured AskUserQuestion menu: a "?"-suffixed question line
// followed by numbered options, with or without a ❯ cursor. Returns null for
// permission gates (Yes/No), @-path lists, and status remnants so they never
// render as fake radio cards. The server's `question` WS event is the primary
// path; this is the PTY-scrape fallback for live menus with no JSONL yet.
function parseAskUserQuestionMenu(stripped: string[]): QuestionBlock | null {
  const inner = stripped.map(stripBoxGutter)

  // Find the LAST "?"-suffixed line that has numbered options below it.
  for (let q = inner.length - 1; q >= 0; q--) {
    const questionText = inner[q]
    if (!QUESTION_SUFFIX_RE.test(questionText)) continue
    // Guard against chrome masquerading as a question.
    if (/^[❯›>]\s/.test(questionText)) continue
    if (/^(Opus|Sonnet|Haiku)\s+\d+\.\d+/.test(questionText)) continue
    if (/^@\//.test(questionText) || /^\/Users\//.test(questionText)) continue

    const options: QuestionOption[] = []
    let selectedIndex = 0
    let sawPermission = false

    for (let i = q + 1; i < inner.length; i++) {
      const line = inner[i]
      if (line === '') {
        if (options.length === 0) continue // gap between question and options
        break
      }
      const m = line.match(NUMBERED_OPTION_RE)
      if (!m) break // first non-numbered line ends the option block
      const label = m[3].trim()
      if (PERMISSION_OPTION_RE.test(label)) {
        sawPermission = true
        break
      }
      if (/\s+\|\s+~\//.test(label) || /^@\//.test(label) || /^\/Users\//.test(label)) break
      if (m[1]) selectedIndex = options.length // ❯ cursor
      options.push({ label })
    }

    if (sawPermission) return null // permission gate, not a structured question
    if (options.length >= 2) {
      return {
        source: 'pty',
        questions: [{ question: questionText, multiSelect: false, options }],
        selectedIndex,
        questionLineIndex: q,
      }
    }
  }

  return null
}

export function parseQuestionBlock(lines: string[]): QuestionBlock | null {
  const stripped = lines.map(stripAnsi)

  // --- Format 1: standard inquirer "? Question" prompt ---
  let questionLineIndex = -1
  for (let i = stripped.length - 1; i >= 0; i--) {
    if (QUESTION_RE.test(stripped[i])) {
      questionLineIndex = i
      break
    }
  }

  if (questionLineIndex !== -1) {
    const questionText = stripped[questionLineIndex].match(QUESTION_RE)![1].trim()
    const options: QuestionOption[] = []
    let selectedIndex = 0

    for (let i = questionLineIndex + 1; i < stripped.length; i++) {
      const line = stripped[i]
      const selectedMatch = line.match(SELECTED_OPTION_RE)
      const unselectedMatch = line.match(UNSELECTED_OPTION_RE)

      if (selectedMatch) {
        selectedIndex = options.length
        options.push({ label: stripNumberedPrefix(selectedMatch[1].trim()) })
      } else if (unselectedMatch) {
        const label = stripNumberedPrefix(unselectedMatch[1].trim())
        // Skip option lines that look like status bar or file paths
        if (/\s+\|\s+~\//.test(label) || /^@\//.test(label) || /^\/Users\//.test(label)) break
        options.push({ label })
      } else {
        break
      }
    }

    if (options.length > 0) {
      return {
        source: 'pty',
        questions: [{ question: questionText, multiSelect: false, options }],
        selectedIndex,
        questionLineIndex,
      }
    }
  }

  // --- Format 3: AskUserQuestion menu — "?"-suffixed question + numbered
  // options, with NO required ❯ cursor (Tab/Arrow navigation). This is the
  // real structured picker that Formats 1 & 2 both miss. ---
  const fmt3 = parseAskUserQuestionMenu(stripped)
  if (fmt3) return fmt3

  // --- Format 2: numbered list with ❯ but no leading "?" ---
  // e.g. Claude Code skill picker: line before ❯ is the question text
  let selectedLineIndex = -1
  for (let i = stripped.length - 1; i >= 0; i--) {
    if (NUMBERED_SELECTED_OPTION_RE.test(stripped[i])) {
      selectedLineIndex = i
      break
    }
  }

  if (selectedLineIndex === -1) return null

  // The question is the closest non-empty line before the ❯ block
  let qIdx = selectedLineIndex - 1
  while (qIdx >= 0 && stripped[qIdx].trim() === '') qIdx--
  if (qIdx < 0) return null

  const questionText = stripped[qIdx].trim()
  // Reject footers AND borders/box-drawing/blank-bracket headers — not real questions.
  if (/Enter to select|↑|↓|Esc to cancel/.test(questionText)) return null
  if (/^[\s│─┌┐└┘├┤┬┴┼╭╮╰╯=_-]+$/.test(questionText)) return null
  // Reject prompt echo/suggestion lines: "> Hi", "> Try \"how do I log an error?\""
  if (/^[❯›>]\s/.test(questionText)) return null
  // Reject status bar fragments: "Sonnet 4.6 | ...", "| ~/path |"
  if (/^(Opus|Sonnet|Haiku)\s+\d+\.\d+/.test(questionText)) return null
  if (/^\|/.test(questionText)) return null
  // Reject attachment/file paths
  if (/^@\//.test(questionText) || /^\/Users\//.test(questionText)) return null

  const options: QuestionOption[] = []
  let selectedIndex = 0

  for (let i = selectedLineIndex; i < stripped.length; i++) {
    const line = stripped[i]
    const selectedMatch = line.match(SELECTED_OPTION_RE)
    const unselectedMatch = line.match(UNSELECTED_OPTION_RE)

    if (selectedMatch) {
      selectedIndex = options.length
      options.push({ label: stripNumberedPrefix(selectedMatch[1].trim()) })
    } else if (unselectedMatch) {
      const label = stripNumberedPrefix(unselectedMatch[1].trim())
      // Skip option lines that look like status bar or file paths
      if (/\s+\|\s+~\//.test(label) || /^@\//.test(label) || /^\/Users\//.test(label)) break
      options.push({ label })
    } else {
      break
    }
  }

  if (options.length === 0) return null
  // A permission gate ("Do you want to proceed? / ❯ 1. Yes / 2. No …") reaches
  // here via its ❯ cursor. It's handled by the structured `permission` WS event,
  // not as a radio card — reject so it doesn't become a fake picker.
  if (options[0] && PERMISSION_OPTION_RE.test(options[0].label)) return null

  return {
    source: 'pty',
    questions: [{ question: questionText, multiSelect: false, options }],
    selectedIndex,
    questionLineIndex: qIdx,
  }
}

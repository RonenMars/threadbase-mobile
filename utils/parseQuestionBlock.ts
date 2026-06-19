import { stripAnsi } from '@/utils/stripAnsi'

export interface QuestionOption {
  label: string
  description?: string
  preview?: string
}
export interface QuestionItem {
  question: string
  header?: string
  multiSelect: boolean
  options: QuestionOption[]
}
export interface QuestionBlock {
  source: 'structured' | 'pty'
  toolUseId?: string
  questions: QuestionItem[]
  /** PTY-scrape only: index of the ❯ cursor row among options of questions[0] */
  selectedIndex?: number
  /** PTY-scrape only: index in source lines[] where the question line sits */
  questionLineIndex?: number
}

const QUESTION_RE = /^\?\s+(.+)$/
const SELECTED_OPTION_RE = /^❯\s+(.+)$/
// Accept 2–3 leading spaces (aligned numbered lists indent to 3). 4+ = tool output.
const UNSELECTED_OPTION_RE = /^ {2,3}(\S.*)$/
// Strip leading "1. " / "2. " numbering from option text
const NUMBERED_PREFIX_RE = /^\d+\.\s+/

function stripNumberedPrefix(s: string): string {
  return s.replace(NUMBERED_PREFIX_RE, '')
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
        options.push({ label: stripNumberedPrefix(unselectedMatch[1].trim()) })
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

  // --- Format 2: numbered list with ❯ but no leading "?" ---
  // e.g. Claude Code skill picker: line before ❯ is the question text
  let selectedLineIndex = -1
  for (let i = stripped.length - 1; i >= 0; i--) {
    if (SELECTED_OPTION_RE.test(stripped[i])) {
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
      options.push({ label: stripNumberedPrefix(unselectedMatch[1].trim()) })
    } else {
      break
    }
  }

  if (options.length === 0) return null

  return {
    source: 'pty',
    questions: [{ question: questionText, multiSelect: false, options }],
    selectedIndex,
    questionLineIndex: qIdx,
  }
}

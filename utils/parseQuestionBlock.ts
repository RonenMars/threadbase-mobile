export interface QuestionBlock {
  questionText: string
  options: string[]
  selectedIndex: number
  /** Index in the source lines[] where the question line sits */
  questionLineIndex: number
}

const QUESTION_RE = /^\?\s+(.+)$/
const SELECTED_OPTION_RE = /^❯\s+(.+)$/
// Exactly 2 spaces — Claude Code inquirer style. Wider indentation (4+) is
// likely tool output or diff context, not a select option.
const UNSELECTED_OPTION_RE = /^ {2}(\S.*)$/

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b(\[[0-9;?]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[A-Z\\])/g

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

export function parseQuestionBlock(lines: string[]): QuestionBlock | null {
  // Scan backward to find the last question line
  let questionLineIndex = -1
  for (let i = lines.length - 1; i >= 0; i--) {
    if (QUESTION_RE.test(stripAnsi(lines[i]))) {
      questionLineIndex = i
      break
    }
  }
  if (questionLineIndex === -1) return null

  const questionMatch = stripAnsi(lines[questionLineIndex]).match(QUESTION_RE)!
  const questionText = questionMatch[1].trim()

  const options: string[] = []
  let selectedIndex = 0

  for (let i = questionLineIndex + 1; i < lines.length; i++) {
    const line = stripAnsi(lines[i])
    const selectedMatch = line.match(SELECTED_OPTION_RE)
    const unselectedMatch = line.match(UNSELECTED_OPTION_RE)

    if (selectedMatch) {
      selectedIndex = options.length
      options.push(selectedMatch[1].trim())
    } else if (unselectedMatch) {
      options.push(unselectedMatch[1].trim())
    } else {
      break
    }
  }

  if (options.length === 0) return null

  return { questionText, options, selectedIndex, questionLineIndex }
}

import type { QuestionBlock } from '@/utils/parseQuestionBlock'

/**
 * Keystrokes that answer permission-gate option `optionIndex`, or null when the
 * block carries nothing for it.
 *
 * The detector's literal `answerKeys` wins when present: some prompts render
 * numbers that don't answer them. A Codex EXEC approval draws "1. yes / 2. no"
 * and is answered by `y` and Escape; a shell `[y/N]` draws no numbers at all.
 * OSC-777 gates carry no answerKeys, so they keep using the real on-screen
 * number — which is why the fallback is `${index}\r` and not a 1-based one.
 */
export function permissionAnswerKeys(
  block: QuestionBlock,
  optionIndex: number,
): string | null {
  const literal = block.permissionAnswerKeys?.[optionIndex]
  if (literal) return literal
  const index = block.permissionIndices?.[optionIndex]
  return index === undefined ? null : `${index}\r`
}

import type { PermissionOption } from '@/types/api'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

// Map a streamer `permission` event into a QuestionBlock the existing
// QuestionCard renders. The gate's prompt becomes the question; its scraped
// options become radio rows. The REAL on-screen numbers are kept in
// `permissionIndices` so an answer sends the actual index (e.g. "2\r"), never a
// 1-based one — the gate can number its options "2. Yes / 3. No". An
// unstructured shell prompt (read -p "[y/N]") reuses this same event but carries
// literal `answerKeys` per option (e.g. "y\r"); those take precedence.
export function mapPermissionToBlock(
  prompt: string | undefined,
  options: PermissionOption[],
  cursor: number | undefined
): QuestionBlock {
  const selectedIndex = cursor !== undefined ? options.findIndex(o => o.index === cursor) : -1
  const hasAnswerKeys = options.some(o => o.answerKeys !== undefined)
  return {
    source: 'permission',
    questions: [
      {
        question: prompt || 'Claude needs your permission',
        multiSelect: false,
        options: options.map(o => ({ label: o.label })),
      },
    ],
    permissionIndices: options.map(o => o.index),
    ...(hasAnswerKeys ? { permissionAnswerKeys: options.map(o => o.answerKeys) } : {}),
    ...(selectedIndex >= 0 ? { selectedIndex } : {}),
  }
}

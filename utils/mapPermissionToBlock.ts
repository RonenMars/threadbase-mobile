import type { PermissionOption } from '@/types/api'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

// Map a streamer `permission` event into a QuestionBlock the existing
// QuestionCard renders. The gate's prompt becomes the question; its scraped
// options become radio rows. The REAL on-screen numbers are kept in
// `permissionIndices` so an answer sends the actual index (e.g. "2\r"), never a
// 1-based one — the gate can number its options "2. Yes / 3. No".
export function mapPermissionToBlock(
  prompt: string | undefined,
  options: PermissionOption[],
  cursor: number | undefined,
  detail?: string,
  contentKey?: string
): QuestionBlock {
  const selectedIndex = cursor !== undefined ? options.findIndex(o => o.index === cursor) : -1
  return {
    source: 'permission',
    questions: [
      {
        question: prompt || 'Claude needs your permission',
        ...(detail ? { detail } : {}),
        multiSelect: false,
        options: options.map(o => ({ label: o.label })),
      },
    ],
    permissionIndices: options.map(o => o.index),
    permissionAnswerKeys: options.map(o => o.answerKeys),
    ...(contentKey !== undefined ? { permissionContentKey: contentKey } : {}),
    ...(selectedIndex >= 0 ? { selectedIndex } : {}),
  }
}

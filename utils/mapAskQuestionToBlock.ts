import type { AskQuestion } from '@/types/api'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

export function mapAskQuestionToBlock(toolUseId: string, questions: AskQuestion[]): QuestionBlock {
  // The answer route refuses a multi-select (400 unsupported_prompt_shape), so
  // fail closed here like the prompt contract: a disabled card, not a tap that
  // ends in an error toast.
  const unsupportedShape = questions.some(q => q.multiSelect) ? 'multi' : undefined
  return {
    source: 'structured',
    toolUseId,
    ...(unsupportedShape ? { unsupportedShape } : {}),
    questions: questions.map(q => ({
      question: q.question,
      header: q.header,
      multiSelect: q.multiSelect,
      options: unsupportedShape ? [] : q.options.map(o => ({ label: o.label, description: o.description, preview: o.preview })),
    })),
  }
}

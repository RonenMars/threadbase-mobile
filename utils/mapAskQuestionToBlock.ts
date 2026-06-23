import type { AskQuestion } from '@/types/api'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

export function mapAskQuestionToBlock(toolUseId: string, questions: AskQuestion[]): QuestionBlock {
  return {
    source: 'structured',
    toolUseId,
    questions: questions.map(q => ({
      question: q.question,
      header: q.header,
      multiSelect: q.multiSelect,
      options: q.options.map(o => ({ label: o.label, description: o.description, preview: o.preview })),
    })),
  }
}

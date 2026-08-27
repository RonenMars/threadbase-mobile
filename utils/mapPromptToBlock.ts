import type { Prompt } from '@/types/api'
import type { QuestionBlock } from '@/utils/parseQuestionBlock'

// Map a provider-neutral `Prompt` into the QuestionBlock the existing card
// renders. Only a single-question, single-select prompt is answerable here;
// anything else fails closed: the block carries `unsupportedShape` and no
// options, so the card cannot offer a tap that would need bytes this client
// must not invent (codex-results D10).
export function unsupportedPromptShape(prompt: Prompt): QuestionBlock['unsupportedShape'] {
  if (prompt.questions.length !== 1) return 'form'
  const mode = prompt.questions[0].inputMode
  if (mode === 'single') return undefined
  if (mode === 'multi' || mode === 'text') return mode
  return 'unknown'
}

export function mapPromptToBlock(prompt: Prompt): QuestionBlock {
  const unsupportedShape = unsupportedPromptShape(prompt)
  return {
    source: 'prompt',
    promptId: prompt.promptId,
    promptRevision: prompt.revision,
    ...(unsupportedShape ? { unsupportedShape } : {}),
    questions: prompt.questions.map((q, index) => ({
      question: q.text,
      ...(q.header ? { header: q.header } : {}),
      // The approval detail block (tool + command) belongs above the first
      // question, exactly where the legacy permission card puts it.
      ...(index === 0 && prompt.detail ? { detail: prompt.detail } : {}),
      questionId: q.questionId,
      multiSelect: q.inputMode === 'multi',
      options: unsupportedShape
        ? []
        : q.options.map(o => ({
            label: o.label,
            optionId: o.optionId,
            ...(o.description ? { description: o.description } : {}),
            ...(o.preview ? { preview: o.preview } : {}),
          })),
    })),
  }
}

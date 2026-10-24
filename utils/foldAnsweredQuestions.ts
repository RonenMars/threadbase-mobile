import type { Message, MessageContent, QuestionAnswerItem } from '@/types/api'

// Shape of an AskUserQuestion tool_use input. Only the fields we render are typed;
// the streamer's AskQuestion has more, but this util reads just these.
interface RawAskQuestion {
  question?: unknown
  header?: unknown
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function readQuestions(input: Record<string, unknown>): { header: string; question: string }[] {
  const questions = input.questions
  if (!Array.isArray(questions)) return []
  const out: { header: string; question: string }[] = []
  for (const q of questions as RawAskQuestion[]) {
    if (!q || typeof q !== 'object') continue
    const question = asString(q.question)
    if (question) out.push({ header: asString(q.header), question })
  }
  return out
}

const ANSWER_PREFIX = /^User has answered your questions?:\s*/i
// Closes the last pair: `"A". You can now continue with the user's answers in mind.`
const ANSWER_TAIL = /"[\s,.]*(You can now continue[\s\S]*)?$/

/**
 * Split Claude Code's AskUserQuestion result into one answer per question.
 * The result reads `"<question>"="<answer>", "<question>"="<answer>". You can
 * now continue…`; answers may themselves hold quotes, so each one runs up to
 * where the next known question starts rather than to the next quote. A
 * result in any other shape lands whole on the last question, unparsed.
 */
export function parseAnswers(content: string, questions: { header: string; question: string }[]): string[] {
  const starts = questions.map(({ header, question }) => {
    for (const key of [question, header]) {
      if (!key) continue
      const marker = `"${key}"="`
      const at = content.indexOf(marker)
      if (at !== -1) return { at, valueAt: at + marker.length }
    }
    return null
  })

  if (starts.every((s) => s === null)) {
    const raw = content.replace(ANSWER_PREFIX, '').trim()
    return questions.map((_, i) => (i === questions.length - 1 ? raw : ''))
  }

  return starts.map((s) => {
    if (!s) return ''
    const next = starts
      .filter((o): o is { at: number; valueAt: number } => o !== null && o.at > s.at)
      .reduce((min, o) => Math.min(min, o.at), content.length)
    return content.slice(s.valueAt, next).replace(ANSWER_TAIL, '').trim()
  })
}

/**
 * Fold every answered AskUserQuestion into a single `question_answer` block.
 *
 * The block takes the tool_use's place in its message, so the card sits where
 * the question was asked and message ids stay stable for FlashList. The matching
 * tool_result is dropped (a message it alone filled is dropped too), since its
 * text is now the card's answer. A question still pending, or one whose result
 * is an error (cancelled, declined), is left as the raw tool cards.
 */
export function foldAnsweredQuestions(messages: Message[]): Message[] {
  const questionsById = new Map<string, { header: string; question: string }[]>()
  for (const m of messages) {
    for (const block of m.content) {
      if (block.type === 'tool_use' && block.name === 'AskUserQuestion' && block.id) {
        const questions = readQuestions(block.input)
        if (questions.length > 0) questionsById.set(block.id, questions)
      }
    }
  }
  if (questionsById.size === 0) return messages

  const itemsById = new Map<string, QuestionAnswerItem[]>()
  for (const m of messages) {
    for (const block of m.content) {
      if (block.type !== 'tool_result' || block.isError || !block.toolUseId) continue
      const questions = questionsById.get(block.toolUseId)
      if (!questions || itemsById.has(block.toolUseId)) continue
      const answers = parseAnswers(block.content, questions)
      itemsById.set(block.toolUseId, questions.map((q, i) => ({ ...q, answer: answers[i] })))
    }
  }
  if (itemsById.size === 0) return messages

  const out: Message[] = []
  for (const m of messages) {
    let changed = false
    const content: MessageContent[] = []
    for (const block of m.content) {
      if (block.type === 'tool_use' && block.id && itemsById.has(block.id)) {
        content.push({ type: 'question_answer', toolUseId: block.id, items: itemsById.get(block.id) ?? [] })
        changed = true
      } else if (block.type === 'tool_result' && block.toolUseId && itemsById.has(block.toolUseId)) {
        changed = true
      } else {
        content.push(block)
      }
    }
    if (!changed) out.push(m)
    else if (content.length > 0) out.push({ ...m, content })
  }
  return out
}

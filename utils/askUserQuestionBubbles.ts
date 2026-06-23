import type { Message } from '@/types/api'

// Shape of an AskUserQuestion tool_use input. Only the fields we render are typed;
// the streamer's AskQuestion has more, but this util reads just these.
interface RawAskQuestion {
  question?: unknown
  header?: unknown
  options?: unknown
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

// Build a human question summary from an AskUserQuestion tool_use input. Each
// question becomes "<header>\n<question>" (header omitted when absent); multiple
// questions are joined with a blank line.
function buildQuestionText(input: Record<string, unknown>): string {
  const questions = input.questions
  if (!Array.isArray(questions)) return ''
  const parts: string[] = []
  for (const q of questions as RawAskQuestion[]) {
    if (!q || typeof q !== 'object') continue
    const header = asString(q.header).trim()
    const question = asString(q.question).trim()
    if (!question) continue
    parts.push(header ? `${header}\n${question}` : question)
  }
  return parts.join('\n\n')
}

function makeBubble(
  id: string,
  role: 'user' | 'assistant',
  text: string,
  source: Message,
): Message {
  return {
    id,
    uuid: null,
    role,
    content: [{ type: 'text', text }],
    timestamp: source.timestamp ?? '',
    is_sidechain: false,
    parent_uuid: null,
  }
}

/**
 * Turn answered AskUserQuestion exchanges into plain chat bubbles.
 *
 * For every `tool_use` block named "AskUserQuestion" that has a matching
 * `tool_result` (correlated by tool_use_id) somewhere in the list, two synthetic
 * bubbles are spliced in immediately after the message that holds the tool_use:
 *   - an assistant bubble with the question text, then
 *   - a user bubble with the answer text (the tool_result content).
 *
 * The original tool_use / tool_result blocks are left untouched (they still
 * render as the collapsed AskUserQuestion summary card). A question with no
 * tool_result yet (still pending) produces no bubbles.
 */
export function extractAnsweredQuestions(messages: Message[]): {
  messages: Message[]
  answeredToolUseIds: Set<string>
} {
  // First pass: map every AskUserQuestion tool_use id → its question text.
  const questionTextById = new Map<string, string>()
  for (const m of messages) {
    for (const block of m.content) {
      if (block.type === 'tool_use' && block.name === 'AskUserQuestion' && block.id) {
        questionTextById.set(block.id, buildQuestionText(block.input))
      }
    }
  }
  if (questionTextById.size === 0) {
    return { messages, answeredToolUseIds: new Set() }
  }

  // Second pass: id → answer text (from the matching tool_result anywhere).
  const answerTextById = new Map<string, string>()
  for (const m of messages) {
    for (const block of m.content) {
      if (
        block.type === 'tool_result' &&
        block.toolUseId &&
        questionTextById.has(block.toolUseId) &&
        !answerTextById.has(block.toolUseId)
      ) {
        answerTextById.set(block.toolUseId, block.content.trim())
      }
    }
  }

  const answeredToolUseIds = new Set(answerTextById.keys())
  if (answeredToolUseIds.size === 0) {
    return { messages, answeredToolUseIds }
  }

  // Third pass: splice the Q&A bubbles in right after the tool_use's message,
  // and drop the answered AskUserQuestion tool_result block — its content is now
  // the answer bubble, so rendering it as a raw tool card too would duplicate it.
  // The tool_use block stays (it renders the collapsed question/options summary).
  const out: Message[] = []
  for (const m of messages) {
    const keptContent = m.content.filter(
      (block) =>
        !(block.type === 'tool_result' && block.toolUseId !== undefined && answeredToolUseIds.has(block.toolUseId)),
    )
    // Drop a message left empty only by removing the answered tool_result (it
    // would otherwise render as a blank row). Keep messages that still have content.
    if (keptContent.length > 0) {
      out.push(keptContent.length === m.content.length ? m : { ...m, content: keptContent })
    }
    for (const block of m.content) {
      if (block.type !== 'tool_use' || block.name !== 'AskUserQuestion' || !block.id) continue
      const answer = answerTextById.get(block.id)
      if (answer === undefined) continue
      const questionText = questionTextById.get(block.id) ?? ''
      out.push(makeBubble(`auq-q-${block.id}`, 'assistant', questionText, m))
      out.push(makeBubble(`auq-a-${block.id}`, 'user', answer, m))
    }
  }

  return { messages: out, answeredToolUseIds }
}

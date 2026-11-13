import type { MergedItem } from '@/components/sessions/now/mergedItems'
import type { Prompt, PromptQuestion, Session } from '@/types/api'
import { stripAnsi } from '@/utils/stripAnsi'

export interface BoardQuestion {
  prompt: Prompt
  question: PromptQuestion
}

/** `open` and `updated` are the actionable states; anything else, known or not, is not. */
export function openPrompts(session: Pick<Session, 'hasOpenPrompt' | 'pendingPrompts'>): Prompt[] {
  // A session_update merges over the list row and never carries the prompts, so the cached ones can outlive the flag.
  if (session.hasOpenPrompt === false) return []
  return (session.pendingPrompts ?? []).filter(
    (p) => (p.state === 'open' || p.state === 'updated') && p.questions.length > 0,
  )
}

/**
 * The server settles a prompt in one POST covering all its questions, so one
 * question this build cannot answer makes the whole prompt unanswerable here.
 * `secret: 'unknown'` passes: it is what the PTY adapter sends on every prompt.
 */
export function isAnswerableOnBoard(prompt: Prompt): boolean {
  return prompt.questions.every((q) => q.inputMode === 'single' && q.options.length > 0 && q.secret !== true)
}

export function boardQuestions(prompts: readonly Prompt[]): BoardQuestion[] {
  return prompts.flatMap((prompt) => prompt.questions.map((question) => ({ prompt, question })))
}

/** Null until every question of the prompt has a reply, since a partial answer is refused as `incomplete_answer`. */
export function promptResponses(
  prompt: Prompt,
  chosen: Readonly<Record<string, string>>,
): { questionId: string; optionIds: string[] }[] | null {
  if (!prompt.questions.every((q) => chosen[q.questionId])) return null
  return prompt.questions.map((q) => ({ questionId: q.questionId, optionIds: [chosen[q.questionId]] }))
}

/** Which sessions have an open prompt: when this changes, the rows' `pendingPrompts` are out of date. */
export function promptRefetchKey(items: readonly MergedItem[]): string {
  return items
    .flatMap((i) => (i.kind === 'session' && i.item.hasOpenPrompt ? [`${i.item.serverId}::${i.item.id}`] : []))
    .sort()
    .join(',')
}

export function terminalTailLine(output: string | null | undefined): string | undefined {
  return stripAnsi(output ?? '').split('\n').map((l) => l.trim()).filter(Boolean).pop()
}

/**
 * What a Needs you card says under its title. `lastOutput` is the last raw PTY chunk, which after a finished
 * turn is Claude Code repainting its hint row, so `hasOpenPrompt === false` means there is nothing to show.
 * The tail survives only where it is the sole signal (older streamers) or the flag says a prompt is open.
 */
export function needsYouLine(
  session: Pick<Session, 'hasOpenPrompt' | 'pendingPrompts' | 'lastOutput'>,
): { text: string; question: boolean } | undefined {
  const question = openPrompts(session)[0]?.questions[0]?.text
  if (question !== undefined) return { text: question, question: true }
  if (session.hasOpenPrompt === false) return undefined
  const tail = terminalTailLine(session.lastOutput)
  return tail ? { text: tail, question: false } : undefined
}

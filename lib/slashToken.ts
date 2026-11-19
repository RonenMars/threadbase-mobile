/**
 * `/` skills in the composer: finding the token at the start of the prompt,
 * ranking the session's skills against it, writing the chosen one back, and
 * telling whether an inserted skill is still untouched.
 * Pure, like mentionToken.ts — the composer hook and the picker share it.
 */

export interface SlashToken {
  /** Always 0: Claude Code only opens its `/` menu at the start of the prompt. */
  start: 0
  /** End of the first word (exclusive), which can lie past the cursor. */
  end: number
  /** Text between the `/` and the cursor. */
  query: string
}

export interface SkillEntry {
  name: string
  description: string
  argumentHint?: string
  source: 'user' | 'project' | 'plugin'
}

export const SKILL_RESULT_LIMIT = 50

export function findSlashToken(text: string, cursor: number): SlashToken | null {
  if (text[0] !== '/' || cursor < 1 || cursor > text.length) return null
  if (/\s/.test(text.slice(0, cursor))) return null
  const space = text.search(/\s/)
  return { start: 0, end: space === -1 ? text.length : space, query: text.slice(1, cursor) }
}

export function rankSkills(
  skills: readonly SkillEntry[],
  query: string,
  limit: number = SKILL_RESULT_LIMIT,
): SkillEntry[] {
  const q = query.toLowerCase()
  const scored: { skill: SkillEntry; score: number; index: number }[] = []
  skills.forEach((skill, index) => {
    const name = skill.name.toLowerCase()
    let score: number
    if (!q || name.startsWith(q)) score = 0
    else if (name.includes(q)) score = 1
    else if (skill.description.toLowerCase().includes(q)) score = 2
    else return
    scored.push({ skill, score, index })
  })
  scored.sort((a, b) => a.score - b.score || a.index - b.index)
  return scored.slice(0, limit).map((s) => s.skill)
}

/** Replace `/query` with the skill's name — no slash, the mark stands for it — and a space. */
export function applySkill(text: string, token: SlashToken, skill: SkillEntry): { text: string; cursor: number } {
  const after = text.slice(token.end)
  const separator = /^\s/.test(after) ? '' : ' '
  return { text: skill.name + separator + after, cursor: skill.name.length + 1 }
}

/** The mark survives only while the name at the start of the text is untouched. */
export function isSkillIntact(text: string, name: string): boolean {
  return text === name || text.startsWith(`${name} `)
}

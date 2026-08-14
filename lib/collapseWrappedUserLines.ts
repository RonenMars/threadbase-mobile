const USER_PREFIX_RE = /^[❯›>]\s(.*)$/
const MAX_LOOKAHEAD = 20

// The PTY does not round-trip whitespace: Claude Code indents wrapped
// continuation rows, and a prompt typed with newlines is echoed as separate
// rows. Compare on collapsed whitespace so neither turns an otherwise exact
// match into a miss.
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Collapses runs of PTY rows that together reconstruct one echoed user
 * prompt (wrapped by Claude Code's own CLI at its terminal width) into a
 * single row holding the ground-truth text from `userMessageTexts`.
 *
 * Matching is exact-string only against `userMessageTexts` (modulo
 * whitespace) — no punctuation or sentence-boundary heuristics, since
 * terminal output also contains prose, trees, and tables that a heuristic
 * could misjoin.
 */
export function collapseWrappedUserLines(
  lines: string[],
  userMessageTexts: Set<string> | undefined,
): string[] {
  if (!userMessageTexts || userMessageTexts.size === 0) return lines

  const groundTruthByNormalized = new Map<string, string>()
  for (const text of userMessageTexts) {
    groundTruthByNormalized.set(normalize(text), text)
  }

  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    const match = lines[i].trim().match(USER_PREFIX_RE)
    if (!match) {
      result.push(lines[i])
      i += 1
      continue
    }

    let accumulated = match[1]
    let matched: string | undefined
    let matchedEnd = -1
    const limit = Math.min(lines.length, i + 1 + MAX_LOOKAHEAD)
    for (let j = i; j < limit; j += 1) {
      if (j > i) accumulated += ' ' + lines[j]
      matched = groundTruthByNormalized.get(normalize(accumulated))
      if (matched !== undefined) {
        matchedEnd = j
        break
      }
    }

    if (matchedEnd === -1 || matched === undefined) {
      result.push(lines[i])
      i += 1
      continue
    }

    result.push(`❯ ${matched}`)
    i = matchedEnd + 1
  }

  return result
}

import type { Language } from 'prism-react-renderer'

/**
 * Fenced-code splitting and language resolution.
 *
 * Moved verbatim out of `components/conversation/MessageBubble.tsx` so the chat
 * and terminal renderers cannot drift apart on what counts as a code fence. The
 * `Language` import is type-only — nothing here touches Prism at runtime, which
 * keeps this module free of React Native and renderer dependencies.
 */

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

// Map fence tag aliases to Prism grammar names (Prism uses 'js' not 'javascript' etc.).
export const LANGUAGE_ALIASES: Record<string, Language> = {
  javascript: 'js',
  typescript: 'tsx',
  ts: 'tsx',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  golang: 'go',
}

// Bare fences (no language tag) get a best-guess from a tiny heuristic. Order
// matters: most specific patterns first, generic fallback last. 'clike' is
// Prism's generic C-family grammar and catches strings/keywords/numbers in
// most curly-brace languages we don't explicitly detect.
export function guessLanguage(code: string): Language {
  const head = code.slice(0, 200)
  // bash: a command at start, possibly preceded by `$ ` prompts or `VAR=value` env assignments.
  if (/^\s*(\$\s+)?(\w+=\S+\s+)*(cd|ls|cat|echo|grep|sed|awk|find|git|npm|npx|yarn|pnpm|brew|sudo|curl|wget|mkdir|rm|mv|cp|chmod|chown|export|source|kill|ps|lsof|tail|head|less|more|tree|jq|docker)\b/m.test(head)) return 'bash'
  // diff: standard header forms, OR a mix of '+' AND '-' prefixed lines (so
  // markdown bullet lists with only '-' don't get misclassified).
  if (/^\s*(diff --git|@@|[-+]{3}\s)/m.test(head)) return 'diff'
  const hasPlusLine = /^\+ /m.test(head)
  const hasMinusLine = /^- /m.test(head)
  if (hasPlusLine && hasMinusLine) return 'diff'
  if (/^\s*\{[\s\S]*"[\w-]+"\s*:/m.test(head)) return 'json'
  if (/^\s*<\?xml|^\s*<!DOCTYPE|^\s*<[a-zA-Z]+[\s>]/m.test(head)) return 'markup'
  if (/^\s*(import\s.+\sfrom\s|export\s+(default\s+)?(function|const|class|interface|type)\s|interface\s+\w+|type\s+\w+\s*=)/m.test(head)) return 'tsx'
  if (/=>|const\s+\w+\s*=|function\s+\w+\s*\(/m.test(head)) return 'tsx'
  if (/^\s*(def|class|import|from)\s+\w+/m.test(head) && /:\s*$/m.test(head)) return 'python'
  if (/^\s*#\s|^\s*\*\s|^\s*\d+\.\s|^\s*```/m.test(head)) return 'markdown'
  return 'clike'
}

export function parseLanguage(rawLang: string | undefined, code: string): Language {
  if (!rawLang) return guessLanguage(code)
  const normalized = rawLang.toLowerCase()
  return LANGUAGE_ALIASES[normalized] ?? (normalized as Language)
}

export type FencePart =
  | { kind: 'code'; code: string; language: Language }
  | { kind: 'text'; text: string }

export function splitFences(text: string): FencePart[] {
  const decoded = decodeEntities(text)
  const parts = decoded.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3)
      const langMatch = inner.match(/^(\w+)\n/)
      const rawCode = langMatch ? inner.slice(langMatch[0].length) : inner
      // Strip the leading/trailing newlines that fence syntax introduces;
      // preserve any blank lines that are part of the actual code body.
      const code = rawCode.replace(/^\n+/, '').replace(/\n+$/, '')
      const language = parseLanguage(langMatch?.[1], code)
      return { kind: 'code' as const, code, language }
    }
    // Trim a single newline on each side that touches a fenced sibling so
    // the visual gap around CodeBlocks doesn't double up with the fence
    // syntax's own newlines. Blank lines elsewhere in the prose are kept.
    const prevIsFence = i > 0 && parts[i - 1].startsWith('```') && parts[i - 1].endsWith('```')
    const nextIsFence = i < parts.length - 1 && parts[i + 1].startsWith('```') && parts[i + 1].endsWith('```')
    let body = part
    if (prevIsFence) body = body.replace(/^\n/, '')
    if (nextIsFence) body = body.replace(/\n$/, '')
    return { kind: 'text' as const, text: body }
  })
}

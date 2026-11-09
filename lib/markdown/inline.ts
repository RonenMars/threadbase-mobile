import type { InlineSpan } from '@/lib/markdown/types'

/**
 * Inline markdown → flat spans.
 *
 * Every rule is newline-bounded on purpose: an unclosed `**` can then never run
 * away and swallow the rest of a message, which is the failure mode that makes
 * a half-written streamed line look like a rendering bug.
 *
 * Ordered alternation does the precedence work — `***` before `**` before `*`,
 * so `**bold**` cannot be read as an emphasised `*bold*` wrapped in stray stars,
 * and bold-italic `***x***` resolves to one strong span rather than leaking a
 * loose delimiter into the text (spans do not nest; see types.ts).
 * Code spans come first and their contents are never re-scanned, so `` `**x**` ``
 * keeps its literal asterisks.
 */
const INLINE_RE =
  /`([^`\n]+)`|\[([^\]\n]*)\]\(([^)\s]+)\)|\*\*\*(?=\S)([^\n]*?\S)\*\*\*|___(?=\S)([^\n]*?\S)___|\*\*(?=\S)([^\n]*?\S)\*\*|__(?=\S)([^\n]*?\S)__|~~(?=\S)([^\n]*?\S)~~|\*(?=\S)([^*\n]*?\S)\*|_(?=\S)([^_\n]*?\S)_|(https?:\/\/[^\s<>]+)/g

const WORD_RE = /\w/

// A bare URL ends where the sentence around it does: "see https://x.test/a."
// must not swallow the full stop, nor a ")" that closes a parenthesis opened
// outside the URL. Only explicit http(s):// links — no `www.` or bare domains,
// which would turn README.md and main.rs into links.
const TRAILING_PUNCT_RE = /[.,;:!?'"\]]$/

function trimBareUrl(url: string): string {
  let out = url
  for (;;) {
    if (TRAILING_PUNCT_RE.test(out)) out = out.slice(0, -1)
    else if (out.endsWith(')') && out.split('(').length < out.split(')').length) out = out.slice(0, -1)
    else return out
  }
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_RE.test(ch)
}

export function parseInline(text: string): InlineSpan[] {
  if (text.length === 0) return []

  const spans: InlineSpan[] = []
  // Literal text seen since the last emitted span. Accumulating rather than
  // pushing per gap is what merges a rejected delimiter back into its
  // neighbours instead of fragmenting the line into many text spans.
  let pending = ''
  let cursor = 0

  INLINE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = INLINE_RE.exec(text)) !== null) {
    const start = m.index
    let end = start + m[0].length

    // Defensive: a zero-length match would spin forever. No alternative above
    // can produce one, so this only guards future edits to the pattern.
    if (end === start) {
      INLINE_RE.lastIndex = start + 1
      continue
    }

    // Underscore emphasis must not fire inside snake_case identifiers, so both
    // edges have to sit on a non-word boundary. Asterisks carry no such rule in
    // CommonMark and are left alone. Checked by hand rather than with a
    // lookbehind, which Hermes cannot be relied on to support.
    const isUnderscore = m[5] !== undefined || m[7] !== undefined || m[10] !== undefined
    if (isUnderscore && (isWordChar(text[start - 1]) || isWordChar(text[end]))) {
      INLINE_RE.lastIndex = start + 1
      continue
    }

    let bareUrl: string | undefined
    if (m[11] !== undefined) {
      bareUrl = trimBareUrl(m[11])
      if (!/^https?:\/\/./.test(bareUrl)) {
        INLINE_RE.lastIndex = start + 1
        continue
      }
      end = start + bareUrl.length
    }

    pending += text.slice(cursor, start)
    if (pending.length > 0) {
      spans.push({ kind: 'text', text: pending })
      pending = ''
    }

    if (m[1] !== undefined) spans.push({ kind: 'code', text: m[1] })
    else if (m[2] !== undefined) spans.push({ kind: 'link', text: m[2] || m[3], href: m[3] })
    else if (m[4] !== undefined) spans.push({ kind: 'strong', text: m[4] })
    else if (m[5] !== undefined) spans.push({ kind: 'strong', text: m[5] })
    else if (m[6] !== undefined) spans.push({ kind: 'strong', text: m[6] })
    else if (m[7] !== undefined) spans.push({ kind: 'strong', text: m[7] })
    else if (m[8] !== undefined) spans.push({ kind: 'strike', text: m[8] })
    else if (m[9] !== undefined) spans.push({ kind: 'em', text: m[9] })
    else if (m[10] !== undefined) spans.push({ kind: 'em', text: m[10] })
    else if (bareUrl !== undefined) spans.push({ kind: 'link', text: bareUrl, href: bareUrl, bare: true })

    cursor = end
  }

  pending += text.slice(cursor)
  if (pending.length > 0) spans.push({ kind: 'text', text: pending })

  return spans
}

/** The markdown source a span was parsed from — what copy and search must see. */
export function spanSource(span: InlineSpan): string {
  switch (span.kind) {
    case 'text':
      return span.text
    case 'code':
      return `\`${span.text}\``
    case 'strong':
      return `**${span.text}**`
    case 'em':
      return `*${span.text}*`
    case 'strike':
      return `~~${span.text}~~`
    case 'link':
      return span.bare ? span.href : `[${span.text}](${span.href})`
  }
}

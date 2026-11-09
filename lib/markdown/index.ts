import { parseBlocks } from '@/lib/markdown/blocks'
import { splitFences } from '@/lib/markdown/fences'
import { spanSource } from '@/lib/markdown/inline'
import type { MarkdownBlock } from '@/lib/markdown/types'

export type { HeadingLevel, InlineSpan, MarkdownBlock } from '@/lib/markdown/types'
export type { FencePart } from '@/lib/markdown/fences'
export { LANGUAGE_ALIASES, decodeEntities, guessLanguage, parseLanguage, splitFences } from '@/lib/markdown/fences'
export { parseBlocks } from '@/lib/markdown/blocks'
export { parseInline, spanSource } from '@/lib/markdown/inline'

/**
 * Markdown source → blocks, for both the terminal and chat renderers.
 *
 * Total by construction: every unrecognised line falls through to a paragraph.
 * The outer guard covers the case construction misses — a future edit to one of
 * the patterns that throws on some input we have not seen. Degrading to the raw
 * source is the "degrade, don't break" rule from CLAUDE.md applied to our own
 * parser: the reader still gets the agent's words, unstyled.
 */
export function parseMarkdown(text: string): MarkdownBlock[] {
  try {
    const out: MarkdownBlock[] = []
    for (const part of splitFences(text)) {
      if (part.kind === 'code') {
        out.push({ kind: 'code', code: part.code, language: part.language })
        continue
      }
      out.push(...parseBlocks(part.text))
    }
    return out
  } catch {
    return [{ kind: 'paragraph', spans: [{ kind: 'text', text }] }]
  }
}

/** The markdown source a parsed block came from — what copy and search must see. */
export function blockSource(block: MarkdownBlock): string {
  switch (block.kind) {
    case 'code':
      return `\`\`\`${block.language}\n${block.code}\n\`\`\``
    case 'rule':
      return '---'
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.spans.map(spanSource).join('')}`
    case 'quote':
      return block.spans
        .map(spanSource)
        .join('')
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')
    case 'listItem':
      return `${'  '.repeat(block.depth)}${block.ordered ? block.marker : '-'} ${block.spans.map(spanSource).join('')}`
    case 'paragraph':
      return block.spans.map(spanSource).join('')
  }
}

/**
 * `parseMarkdown`, memoised against the object that owns the text.
 *
 * FlashList re-binds a recycled cell with a different row's props, so a parse
 * living in a component body runs again on every bind while a turn streams.
 * Keying on the content block itself (transcript messages are immutable and
 * reference-stable once adapted) makes it once per block for the session, and a
 * WeakMap means no cache size to manage. The stored text is compared as well, so
 * a caller that does mutate an owner in place gets a correct reparse rather than
 * a stale render.
 */
const parseCache = new WeakMap<object, { text: string; blocks: MarkdownBlock[] }>()

export function parseMarkdownFor(owner: object, text: string): MarkdownBlock[] {
  const hit = parseCache.get(owner)
  if (hit && hit.text === text) return hit.blocks
  const blocks = parseMarkdown(text)
  parseCache.set(owner, { text, blocks })
  return blocks
}

import { parseInline } from '@/lib/markdown/inline'
import type { HeadingLevel, MarkdownBlock } from '@/lib/markdown/types'

/**
 * Prose → blocks. Fenced code never reaches here; `splitFences` has already
 * taken it out, so this only classifies the text between fences.
 *
 * Anything unrecognised becomes a paragraph. That fallthrough is the whole
 * safety property: a markdown construct we don't support (a table, an image)
 * renders as its own source text rather than disappearing.
 */

// `---`, `***`, `___`, and the spaced `- - -` form. Up to three leading spaces,
// per CommonMark. Checked before the list rules so `- - -` is not three items.
const RULE_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const HEADING_RE = /^ {0,3}(#{1,6})[ \t]+(.*)$/
const QUOTE_RE = /^ {0,3}> ?(.*)$/
const LIST_RE = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/

// Depth is cosmetic — one glyph per level, cycling. Agent output rarely nests
// past two, and a deeper list still renders rather than running out of markers.
const BULLETS = ['•', '◦', '▪']

function bulletFor(depth: number): string {
  return BULLETS[depth % BULLETS.length]
}

/** Two spaces per level, the convention every agent CLI emits. Tabs count as one level. */
function depthFor(indent: string): number {
  const columns = indent.replace(/\t/g, '  ').length
  return Math.min(Math.floor(columns / 2), 8)
}

function headingLevel(hashes: string): HeadingLevel {
  return hashes.length as HeadingLevel
}

export function parseBlocks(text: string): MarkdownBlock[] {
  const out: MarkdownBlock[] = []
  // Buffers for the two run-length blocks: consecutive plain lines become one
  // paragraph, consecutive `>` lines become one quote. Newlines inside them are
  // kept rather than collapsed to spaces — an agent's line breaks are
  // deliberate, and collapsing them reflows output that was written to be read
  // as written.
  let paragraph: string[] = []
  let quote: string[] = []

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    out.push({ kind: 'paragraph', spans: parseInline(paragraph.join('\n')) })
    paragraph = []
  }
  const flushQuote = () => {
    if (quote.length === 0) return
    out.push({ kind: 'quote', spans: parseInline(quote.join('\n')) })
    quote = []
  }
  const flushAll = () => {
    flushParagraph()
    flushQuote()
  }

  for (const raw of text.split('\n')) {
    const line = raw.replace(/[ \t]+$/, '')

    if (line.trim().length === 0) {
      flushAll()
      continue
    }

    if (RULE_RE.test(line)) {
      flushAll()
      out.push({ kind: 'rule' })
      continue
    }

    const heading = line.match(HEADING_RE)
    if (heading) {
      flushAll()
      // A trailing closing sequence (`## Title ##`) is decoration, not content.
      const body = heading[2].replace(/[ \t]+#+[ \t]*$/, '')
      out.push({ kind: 'heading', level: headingLevel(heading[1]), spans: parseInline(body) })
      continue
    }

    const quoted = line.match(QUOTE_RE)
    if (quoted) {
      flushParagraph()
      quote.push(quoted[1])
      continue
    }

    const item = line.match(LIST_RE)
    if (item) {
      flushAll()
      const ordered = !/^[-*+]$/.test(item[2])
      const depth = depthFor(item[1])
      out.push({
        kind: 'listItem',
        ordered,
        depth,
        marker: ordered ? item[2] : bulletFor(depth),
        spans: parseInline(item[3]),
      })
      continue
    }

    flushQuote()
    paragraph.push(line)
  }

  flushAll()
  return out
}

import { parseInline } from '@/lib/markdown/inline'
import type { HeadingLevel, InlineSpan, MarkdownBlock, TableAlign } from '@/lib/markdown/types'

/**
 * Prose → blocks. Fenced code never reaches here; `splitFences` has already
 * taken it out, so this only classifies the text between fences.
 *
 * Anything unrecognised becomes a paragraph. That fallthrough is the whole
 * safety property: a markdown construct we don't support (an image, a table
 * whose delimiter row is malformed) renders as its own source text rather than
 * disappearing.
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

const DELIMITER_CELL_RE = /^(:)?-+(:)?$/

/**
 * One table row → trimmed cell strings. The outer pipes are optional, and `\|`
 * is a literal pipe inside a cell. GFM does not shield pipes inside code spans,
 * so neither do we.
 */
function splitRow(line: string): string[] {
  let body = line.trim()
  if (body.startsWith('|')) body = body.slice(1)
  if (body.endsWith('|') && !body.endsWith('\\|')) body = body.slice(0, -1)
  const cells: string[] = []
  let cell = ''
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '\\' && body[i + 1] === '|') {
      cell += '|'
      i++
    } else if (body[i] === '|') {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += body[i]
    }
  }
  cells.push(cell.trim())
  return cells
}

/** The alignment per column, or null when `line` is not a delimiter row of `width` columns. */
function parseDelimiter(line: string, width: number): TableAlign[] | null {
  if (!line.includes('|')) return null
  const cells = splitRow(line)
  if (cells.length !== width) return null
  const align: TableAlign[] = []
  for (const cell of cells) {
    const m = cell.match(DELIMITER_CELL_RE)
    if (!m) return null
    align.push(m[1] && m[2] ? 'center' : m[2] ? 'right' : m[1] ? 'left' : 'default')
  }
  return align
}

/** Cut or pad to the header width so every row of a table block has the same shape. */
function toCells(line: string, width: number): InlineSpan[][] {
  const raw = splitRow(line)
  return Array.from({ length: width }, (_, i) => parseInline(raw[i] ?? ''))
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

  const lines = text.split('\n').map((raw) => raw.replace(/[ \t]+$/, ''))

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]

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

    // A table needs its delimiter row on the next line; without one the header
    // is ordinary prose and falls through. It may follow a paragraph line with
    // no blank between, which is how agents write them.
    const delimiter = line.includes('|') ? parseDelimiter(lines[index + 1] ?? '', splitRow(line).length) : null
    if (delimiter) {
      flushAll()
      const width = delimiter.length
      let end = index + 1
      const rows: InlineSpan[][][] = []
      // A body row is any following line that still has a pipe; the first blank
      // or pipe-less line ends the table so trailing prose is not swallowed.
      while (end + 1 < lines.length && lines[end + 1].includes('|')) {
        end++
        rows.push(toCells(lines[end], width))
      }
      out.push({
        kind: 'table',
        align: delimiter,
        header: toCells(line, width),
        rows,
        source: lines.slice(index, end + 1).join('\n'),
      })
      index = end
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

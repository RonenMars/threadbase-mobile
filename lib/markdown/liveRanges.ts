import type { MarkdownRange } from '@expensify/react-native-live-markdown'

/**
 * Styling ranges for the composer's live markdown input. It runs as a worklet
 * on the library's own runtime, so it stays self-contained: no imports, no
 * calls into the rest of `lib/markdown`.
 *
 * It is written against CommonMark (`**bold**`, `*italic*`) because the draft
 * goes to an agent that reads CommonMark. The library's bundled ExpensiMark
 * parser reads `*x*` as bold, and it needs `expensify-common`, which this repo
 * does not install.
 *
 * Offsets are UTF-16 indexes, which is what the native side expects.
 */
export function parseLiveMarkdown(text: string): MarkdownRange[] {
  'worklet'
  const ranges: MarkdownRange[] = []
  const syntax = (start: number, length: number) => {
    ranges.push({ type: 'syntax', start, length })
  }
  // Wraps each match in syntax/style/syntax, then blanks it out of `masked`
  // so later passes cannot match inside it.
  const inline = (
    masked: string,
    offset: number,
    re: RegExp,
    type: MarkdownRange['type'],
    open: number,
    close: number,
  ): string => {
    return masked.replace(re, (match: string, lead: string, body: string, index: number) => {
      const at = offset + index + lead.length
      syntax(at, open)
      ranges.push({ type, start: at + open, length: body.length })
      syntax(at + open + body.length, close)
      return lead + ' '.repeat(match.length - lead.length)
    })
  }

  const lines = text.split('\n')
  let offset = 0
  let fenceStart = -1
  for (const line of lines) {
    const lineEnd = offset + line.length
    if (fenceStart >= 0) {
      if (/^```\s*$/.test(line)) {
        if (offset - 1 > fenceStart) ranges.push({ type: 'pre', start: fenceStart, length: offset - 1 - fenceStart })
        syntax(offset, line.length)
        fenceStart = -1
      }
    } else if (line.startsWith('```')) {
      syntax(offset, line.length)
      fenceStart = lineEnd + 1
    } else {
      let masked = line
      const quote = /^>+ ?/.exec(line)
      if (quote) {
        ranges.push({ type: 'blockquote', start: offset, length: line.length, depth: quote[0].trim().length })
        syntax(offset, quote[0].length)
        masked = ' '.repeat(quote[0].length) + line.slice(quote[0].length)
      } else if (/^# \S/.test(line)) {
        syntax(offset, 2)
        ranges.push({ type: 'h1', start: offset + 2, length: line.length - 2 })
        masked = '  ' + line.slice(2)
      }
      masked = inline(masked, offset, /()`([^`]+)`/g, 'code', 1, 1)
      masked = masked.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match: string, label: string, _url: string, index: number) => {
        syntax(offset + index, 1)
        ranges.push({ type: 'link', start: offset + index + 1, length: label.length })
        syntax(offset + index + 1 + label.length, match.length - 1 - label.length)
        return ' '.repeat(match.length)
      })
      masked = inline(masked, offset, /()\*\*(\S(?:[^*]*?\S)?)\*\*/g, 'bold', 2, 2)
      masked = inline(masked, offset, /()~~(\S(?:[^~]*?\S)?)~~/g, 'strikethrough', 2, 2)
      masked = inline(masked, offset, /(^|[^\w*])\*(\S(?:[^*]*?\S)?)\*(?![\w*])/g, 'italic', 1, 1)
      inline(masked, offset, /(^|[^\w])_(\S(?:[^_]*?\S)?)_(?!\w)/g, 'italic', 1, 1)
    }
    offset = lineEnd + 1
  }
  if (fenceStart >= 0 && fenceStart < text.length) {
    ranges.push({ type: 'pre', start: fenceStart, length: text.length - fenceStart })
  }
  return ranges.sort((a, b) => a.start - b.start || b.length - a.length)
}

/** The toggle's off state: the same input, no styling. */
export function parseNoMarkdown(_text: string): MarkdownRange[] {
  'worklet'
  return []
}

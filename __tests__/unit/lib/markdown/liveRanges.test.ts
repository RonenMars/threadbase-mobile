import { parseLiveMarkdown, parseNoMarkdown } from '@/lib/markdown/liveRanges'

const s = (start: number, length: number) => ({ type: 'syntax', start, length })

describe('parseLiveMarkdown', () => {
  it('styles bold between dimmed markers', () => {
    expect(parseLiveMarkdown('a **bold** b')).toEqual([s(2, 2), { type: 'bold', start: 4, length: 4 }, s(8, 2)])
  })

  it('styles * and _ italics', () => {
    expect(parseLiveMarkdown('*it* and _em_')).toEqual([
      s(0, 1), { type: 'italic', start: 1, length: 2 }, s(3, 1),
      s(9, 1), { type: 'italic', start: 10, length: 2 }, s(12, 1),
    ])
  })

  it('leaves snake_case identifiers alone', () => {
    expect(parseLiveMarkdown('snake_case_name')).toEqual([])
  })

  it('needs a non-word character before an underscore italic', () => {
    expect(parseLiveMarkdown('file_name_ x')).toEqual([])
  })

  it('records nested blockquote depth', () => {
    expect(parseLiveMarkdown('>> x')).toEqual([{ type: 'blockquote', start: 0, length: 4, depth: 2 }, s(0, 3)])
  })

  it('returns ranges in text order across passes', () => {
    expect(parseLiveMarkdown('**a** `b`')).toEqual([
      s(0, 2), { type: 'bold', start: 2, length: 1 }, s(3, 2),
      s(6, 1), { type: 'code', start: 7, length: 1 }, s(8, 1),
    ])
  })

  it('does not close a fence on a line with an info string', () => {
    expect(parseLiveMarkdown('```\na\n```js\nb')).toEqual([s(0, 3), { type: 'pre', start: 4, length: 9 }])
  })

  it('styles strikethrough', () => {
    expect(parseLiveMarkdown('~~gone~~')).toEqual([s(0, 2), { type: 'strikethrough', start: 2, length: 4 }, s(6, 2)])
  })

  it('treats a code span as opaque', () => {
    expect(parseLiveMarkdown('`x **y**`')).toEqual([s(0, 1), { type: 'code', start: 1, length: 7 }, s(8, 1)])
  })

  it('ignores an unclosed marker', () => {
    expect(parseLiveMarkdown('a **open')).toEqual([])
  })

  it('styles a blockquote line and its inline content', () => {
    expect(parseLiveMarkdown('> **b**')).toEqual([
      { type: 'blockquote', start: 0, length: 7, depth: 1 },
      s(0, 2),
      s(2, 2), { type: 'bold', start: 4, length: 1 }, s(5, 2),
    ])
  })

  it('styles a level-one heading', () => {
    expect(parseLiveMarkdown('# Title')).toEqual([s(0, 2), { type: 'h1', start: 2, length: 5 }])
  })

  it('styles link text and dims the url', () => {
    expect(parseLiveMarkdown('[docs](https://x.y)')).toEqual([s(0, 1), { type: 'link', start: 1, length: 4 }, s(5, 14)])
  })

  it('styles a closed fence', () => {
    expect(parseLiveMarkdown('```ts\nconst a = 1\n```')).toEqual([s(0, 5), { type: 'pre', start: 6, length: 11 }, s(18, 3)])
  })

  it('styles an unclosed fence to the end and nothing inside it', () => {
    expect(parseLiveMarkdown('```\nabc **x**')).toEqual([s(0, 3), { type: 'pre', start: 4, length: 9 }])
  })

  it('resumes inline styling after a fence closes', () => {
    expect(parseLiveMarkdown('```\nx\n```\n**b**')).toEqual([
      s(0, 3), { type: 'pre', start: 4, length: 1 }, s(6, 3),
      s(10, 2), { type: 'bold', start: 12, length: 1 }, s(13, 2),
    ])
  })

  it('carries offsets across lines', () => {
    expect(parseLiveMarkdown('line1\n**b**')).toEqual([s(6, 2), { type: 'bold', start: 8, length: 1 }, s(9, 2)])
  })

  it('counts offsets in RTL text', () => {
    expect(parseLiveMarkdown('שלום **עולם**')).toEqual([s(5, 2), { type: 'bold', start: 7, length: 4 }, s(11, 2)])
  })

  it('counts an emoji as two UTF-16 units', () => {
    expect(parseLiveMarkdown('😀 `x`')).toEqual([s(3, 1), { type: 'code', start: 4, length: 1 }, s(5, 1)])
  })
})

describe('parseNoMarkdown', () => {
  it('returns no ranges', () => {
    expect(parseNoMarkdown('**bold** `code`')).toEqual([])
  })
})

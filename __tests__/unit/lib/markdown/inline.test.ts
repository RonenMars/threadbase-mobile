import { parseInline, spanSource } from '@/lib/markdown/inline'
import type { InlineSpan } from '@/lib/markdown/types'

const text = (t: string): InlineSpan => ({ kind: 'text', text: t })

describe('parseInline', () => {
  it('returns nothing for an empty string', () => {
    expect(parseInline('')).toEqual([])
  })

  it('passes plain prose through as one span', () => {
    expect(parseInline('just words here')).toEqual([text('just words here')])
  })

  it('parses the five inline marks', () => {
    expect(parseInline('a **b** c *d* e `f` g ~~h~~')).toEqual([
      text('a '),
      { kind: 'strong', text: 'b' },
      text(' c '),
      { kind: 'em', text: 'd' },
      text(' e '),
      { kind: 'code', text: 'f' },
      text(' g '),
      { kind: 'strike', text: 'h' },
    ])
  })

  it('prefers strong over emphasis so ** is never read as a stray star', () => {
    expect(parseInline('**bold**')).toEqual([{ kind: 'strong', text: 'bold' }])
    expect(parseInline('__bold__')).toEqual([{ kind: 'strong', text: 'bold' }])
  })

  it('does not re-scan inside a code span', () => {
    expect(parseInline('`**not bold**`')).toEqual([{ kind: 'code', text: '**not bold**' }])
  })

  it('parses links and falls back to the href when the text is empty', () => {
    expect(parseInline('see [the doc](https://x.test/a)')).toEqual([
      text('see '),
      { kind: 'link', text: 'the doc', href: 'https://x.test/a' },
    ])
    expect(parseInline('[](https://x.test/b)')).toEqual([
      { kind: 'link', text: 'https://x.test/b', href: 'https://x.test/b' },
    ])
  })

  it('leaves arithmetic and unclosed delimiters literal', () => {
    expect(parseInline('2 * 3 * 4')).toEqual([text('2 * 3 * 4')])
    expect(parseInline('**unclosed')).toEqual([text('**unclosed')])
    expect(parseInline('a * b')).toEqual([text('a * b')])
  })

  it('does not emphasise inside snake_case', () => {
    expect(parseInline('call some_long_name now')).toEqual([text('call some_long_name now')])
    expect(parseInline('_bar_baz')).toEqual([text('_bar_baz')])
  })

  it('still emphasises an underscore pair on a word boundary', () => {
    expect(parseInline('a _b_ c')).toEqual([text('a '), { kind: 'em', text: 'b' }, text(' c')])
  })

  it('never lets a mark span a newline', () => {
    expect(parseInline('**a\nb**')).toEqual([text('**a\nb**')])
  })

  it('merges literal text around a rejected delimiter into one span', () => {
    expect(parseInline('x_y_z and more')).toEqual([text('x_y_z and more')])
  })

  it('handles adjacent marks with no text between them', () => {
    expect(parseInline('**a**`b`')).toEqual([
      { kind: 'strong', text: 'a' },
      { kind: 'code', text: 'b' },
    ])
  })
})

describe('spanSource', () => {
  it('round-trips every span kind back to markdown', () => {
    const cases = ['plain', '**bold**', '*em*', '`code`', '~~gone~~', '[t](https://x.test)']
    for (const source of cases) {
      expect(parseInline(source).map(spanSource).join('')).toBe(source)
    }
  })
})

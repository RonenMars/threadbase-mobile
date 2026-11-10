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

describe('bare URLs', () => {
  const link = (url: string) => ({ kind: 'link', text: url, href: url, bare: true })

  it('links a bare http(s) URL in running text', () => {
    expect(parseInline('see https://macsources.com/category/featured/apps/ now')).toEqual([
      { kind: 'text', text: 'see ' },
      link('https://macsources.com/category/featured/apps/'),
      { kind: 'text', text: ' now' },
    ])
  })

  it('leaves sentence punctuation and an outer closing paren out of the URL', () => {
    expect(parseInline('go to https://x.test/a.')).toEqual([
      { kind: 'text', text: 'go to ' },
      link('https://x.test/a'),
      { kind: 'text', text: '.' },
    ])
    expect(parseInline('(see https://x.test/a)')).toEqual([
      { kind: 'text', text: '(see ' },
      link('https://x.test/a'),
      { kind: 'text', text: ')' },
    ])
  })

  it('keeps a paren that balances one inside the URL', () => {
    expect(parseInline('https://x.test/a_(b)')).toEqual([link('https://x.test/a_(b)')])
  })

  it('does not link file names, www. hosts or a bare scheme', () => {
    for (const text of ['edit README.md or main.rs', 'www.example.com', 'https://', 'https://.']) {
      expect(parseInline(text)).toEqual([{ kind: 'text', text }])
    }
  })

  it('does not double-link a markdown link or touch a code span', () => {
    expect(parseInline('[docs](https://x.test/a)')).toEqual([
      { kind: 'link', text: 'docs', href: 'https://x.test/a' },
    ])
    expect(parseInline('`https://x.test/a`')).toEqual([{ kind: 'code', text: 'https://x.test/a' }])
  })

  it('round-trips to the URL as written', () => {
    for (const source of ['https://x.test/a', 'open https://x.test/a_b_c today']) {
      expect(parseInline(source).map(spanSource).join('')).toBe(source)
    }
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

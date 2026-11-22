import { parseBlocks } from '@/lib/markdown/blocks'

describe('parseBlocks', () => {
  it('parses ATX headings and strips a closing sequence', () => {
    expect(parseBlocks('# One\n### Three ###')).toEqual([
      { kind: 'heading', level: 1, spans: [{ kind: 'text', text: 'One' }] },
      { kind: 'heading', level: 3, spans: [{ kind: 'text', text: 'Three' }] },
    ])
  })

  it('needs a space after the hashes', () => {
    const blocks = parseBlocks('#hashtag')
    expect(blocks).toEqual([{ kind: 'paragraph', spans: [{ kind: 'text', text: '#hashtag' }] }])
  })

  it('keeps consecutive plain lines in one paragraph, newlines intact', () => {
    expect(parseBlocks('first\nsecond')).toEqual([
      { kind: 'paragraph', spans: [{ kind: 'text', text: 'first\nsecond' }] },
    ])
  })

  it('splits paragraphs on a blank line', () => {
    const blocks = parseBlocks('one\n\ntwo')
    expect(blocks).toHaveLength(2)
    expect(blocks.every((b) => b.kind === 'paragraph')).toBe(true)
  })

  it('parses unordered items with a depth-derived glyph', () => {
    expect(parseBlocks('- top\n  - nested\n    - deeper')).toEqual([
      { kind: 'listItem', ordered: false, depth: 0, marker: '•', spans: [{ kind: 'text', text: 'top' }] },
      { kind: 'listItem', ordered: false, depth: 1, marker: '◦', spans: [{ kind: 'text', text: 'nested' }] },
      { kind: 'listItem', ordered: false, depth: 2, marker: '▪', spans: [{ kind: 'text', text: 'deeper' }] },
    ])
  })

  it('keeps an ordered item ordinal as its marker', () => {
    expect(parseBlocks('3. third\n4) fourth')).toEqual([
      { kind: 'listItem', ordered: true, depth: 0, marker: '3.', spans: [{ kind: 'text', text: 'third' }] },
      { kind: 'listItem', ordered: true, depth: 0, marker: '4)', spans: [{ kind: 'text', text: 'fourth' }] },
    ])
  })

  it('parses inline marks inside a list item', () => {
    expect(parseBlocks('- run **npm ci**')).toEqual([
      {
        kind: 'listItem',
        ordered: false,
        depth: 0,
        marker: '•',
        spans: [{ kind: 'text', text: 'run ' }, { kind: 'strong', text: 'npm ci' }],
      },
    ])
  })

  it('merges a contiguous block quote', () => {
    expect(parseBlocks('> one\n> two')).toEqual([
      { kind: 'quote', spans: [{ kind: 'text', text: 'one\ntwo' }] },
    ])
  })

  it('parses thematic breaks in all three forms, spaced included', () => {
    expect(parseBlocks('---\n***\n___\n- - -')).toEqual([
      { kind: 'rule' },
      { kind: 'rule' },
      { kind: 'rule' },
      { kind: 'rule' },
    ])
  })

  it('reads bold-italic as one strong span, not a rule or a stray star', () => {
    expect(parseBlocks('***emphatic***')).toEqual([
      { kind: 'paragraph', spans: [{ kind: 'strong', text: 'emphatic' }] },
    ])
    expect(parseBlocks('___emphatic___')).toEqual([
      { kind: 'paragraph', spans: [{ kind: 'strong', text: 'emphatic' }] },
    ])
  })

  describe('tables', () => {
    const t = (text: string) => [{ kind: 'text' as const, text }]

    it('parses a header, delimiter row and body into one table block', () => {
      const source = '| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |'
      expect(parseBlocks(source)).toEqual([
        {
          kind: 'table',
          align: ['default', 'default'],
          header: [t('a'), t('b')],
          rows: [
            [t('1'), t('2')],
            [t('3'), t('4')],
          ],
          source,
        },
      ])
    })

    it('reads column alignment from the delimiter colons', () => {
      const [table] = parseBlocks('| l | c | r | d |\n|:--|:-:|--:|---|\n| 1 | 2 | 3 | 4 |')
      expect(table).toMatchObject({ kind: 'table', align: ['left', 'center', 'right', 'default'] })
    })

    it('accepts rows written without the outer pipes', () => {
      const [table] = parseBlocks('a | b\n--|--\n1 | 2')
      expect(table).toMatchObject({ kind: 'table', header: [t('a'), t('b')], rows: [[t('1'), t('2')]] })
    })

    it('parses inline markdown inside cells', () => {
      const [table] = parseBlocks('| **name** | `code` |\n|---|---|\n| [x](https://e.test) | ~~y~~ |')
      expect(table).toMatchObject({
        header: [[{ kind: 'strong', text: 'name' }], [{ kind: 'code', text: 'code' }]],
        rows: [[[{ kind: 'link', text: 'x', href: 'https://e.test' }], [{ kind: 'strike', text: 'y' }]]],
      })
    })

    it('keeps an escaped pipe inside its cell', () => {
      const [table] = parseBlocks('| a \\| b | c |\n|---|---|\n| 1 | 2 |')
      expect(table).toMatchObject({ header: [t('a | b'), t('c')] })
    })

    it('keeps an escaped pipe at the very end of a row instead of reading it as the closing pipe', () => {
      const [table] = parseBlocks('| a | b \\|\n|---|---|\n| 1 | 2 |')
      expect(table).toMatchObject({ header: [t('a'), t('b |')] })
    })

    it('pads a short row and drops cells past the header width', () => {
      const [table] = parseBlocks('| a | b |\n|---|---|\n| 1 |\n| 1 | 2 | 3 |')
      expect(table).toMatchObject({ rows: [[t('1'), []], [t('1'), t('2')]] })
    })

    it('renders a header-only table', () => {
      const [table] = parseBlocks('| a | b |\n|---|---|')
      expect(table).toMatchObject({ kind: 'table', rows: [] })
    })

    it('ends the table at a blank line and keeps what follows', () => {
      const blocks = parseBlocks('| a |\n|---|\n| 1 |\n\nafter')
      expect(blocks.map((b) => b.kind)).toEqual(['table', 'paragraph'])
    })

    it('ends the table at a line without a pipe', () => {
      const blocks = parseBlocks('| a |\n|---|\n| 1 |\nplain')
      expect(blocks.map((b) => b.kind)).toEqual(['table', 'paragraph'])
    })

    it('starts a table straight after a paragraph line, with no blank line between', () => {
      const blocks = parseBlocks('Here it is:\n| a |\n|---|\n| 1 |')
      expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'table'])
    })

    it('falls back to one paragraph when there is no delimiter row, keeping every pipe', () => {
      const source = '| a | b |\n| 1 | 2 |'
      expect(parseBlocks(source)).toEqual([{ kind: 'paragraph', spans: [{ kind: 'text', text: source }] }])
    })

    it('falls back to a paragraph when the delimiter width differs from the header', () => {
      const source = '| a | b |\n|---|\n| 1 | 2 |'
      expect(parseBlocks(source).map((b) => b.kind)).toEqual(['paragraph'])
    })

    it('does not read a pipe-less setext underline as a table', () => {
      expect(parseBlocks('title\n---').map((b) => b.kind)).toEqual(['paragraph', 'rule'])
    })
  })

  it('returns nothing for blank input', () => {
    expect(parseBlocks('')).toEqual([])
    expect(parseBlocks('\n\n  \n')).toEqual([])
  })

  it('ends a quote when plain prose resumes', () => {
    expect(parseBlocks('> quoted\nplain')).toEqual([
      { kind: 'quote', spans: [{ kind: 'text', text: 'quoted' }] },
      { kind: 'paragraph', spans: [{ kind: 'text', text: 'plain' }] },
    ])
  })
})

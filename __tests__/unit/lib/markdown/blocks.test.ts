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

  it('falls through to one paragraph for a table, keeping every pipe literal', () => {
    const source = '| a | b |\n|---|---|\n| 1 | 2 |'
    // A pipe-led delimiter row is not a thematic break, so the whole table stays
    // one paragraph. Nothing is dropped, which is the property that matters
    // until tables get a block of their own.
    expect(parseBlocks(source)).toEqual([
      { kind: 'paragraph', spans: [{ kind: 'text', text: source }] },
    ])
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

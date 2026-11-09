import { blockSource, parseMarkdown } from '@/lib/markdown'

describe('parseMarkdown', () => {
  it('lifts a fenced block out of the surrounding prose', () => {
    const blocks = parseMarkdown('Run this:\n\n```bash\nnpm ci\n```\n\nThen retry.')
    expect(blocks).toEqual([
      { kind: 'paragraph', spans: [{ kind: 'text', text: 'Run this:' }] },
      { kind: 'code', code: 'npm ci', language: 'bash' },
      { kind: 'paragraph', spans: [{ kind: 'text', text: 'Then retry.' }] },
    ])
  })

  it('guesses a language for a bare fence', () => {
    const blocks = parseMarkdown('```\ngit status\n```')
    expect(blocks).toEqual([{ kind: 'code', code: 'git status', language: 'bash' }])
  })

  it('never parses markdown inside a fence', () => {
    const blocks = parseMarkdown('```\n# not a heading\n- not a list\n```')
    expect(blocks).toEqual([
      { kind: 'code', code: '# not a heading\n- not a list', language: 'markdown' },
    ])
  })

  it('decodes HTML entities in prose, as the chat view always has', () => {
    expect(parseMarkdown('a &lt;b&gt; c')).toEqual([
      { kind: 'paragraph', spans: [{ kind: 'text', text: 'a <b> c' }] },
    ])
  })

  it('parses a realistic agent answer end to end', () => {
    const source = [
      '## What I changed',
      '',
      'Two files, both under `lib/`:',
      '',
      '- **blocks.ts** — the line classifier',
      '- **inline.ts** — the span scanner',
      '',
      '> Tables are still out of scope.',
    ].join('\n')
    expect(parseMarkdown(source).map((b) => b.kind)).toEqual([
      'heading',
      'paragraph',
      'listItem',
      'listItem',
      'quote',
    ])
  })

  it('returns nothing for an empty string', () => {
    expect(parseMarkdown('')).toEqual([])
  })

  it('keeps an unterminated fence as prose rather than swallowing the tail', () => {
    const blocks = parseMarkdown('before\n```bash\nnpm ci')
    // An opening fence with no close is still being streamed. Nothing may be
    // dropped, so the raw text has to survive as paragraph content.
    const rendered = blocks.map(blockSource).join('\n')
    expect(rendered).toContain('npm ci')
    expect(rendered).toContain('before')
  })
})

describe('blockSource', () => {
  it('round-trips each block kind back to equivalent markdown', () => {
    const cases = [
      '# Heading',
      'plain paragraph',
      '> quoted line',
      '- bullet item',
      '3. ordered item',
      '---',
      '```bash\nnpm ci\n```',
    ]
    for (const source of cases) {
      const blocks = parseMarkdown(source)
      expect(blocks).toHaveLength(1)
      expect(blockSource(blocks[0])).toBe(source)
    }
  })

  it('normalises rather than preserving bytes, so it is not a lossless codec', () => {
    // Bold-italic collapses to strong, and `4)` to `4.` — equivalent markdown,
    // different bytes. Callers that need the exact original must keep the source
    // string; this is for copy and search, which only need to read the same.
    expect(blockSource(parseMarkdown('***x***')[0])).toBe('**x**')
  })
})

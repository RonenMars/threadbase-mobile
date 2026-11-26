import { messageCodeBlocks, messageMarkdown, messagePlainText, quoteAsMarkdown } from '@/lib/messageText'
import type { Message } from '@/types/api'

function msg(...texts: string[]): Message {
  return {
    id: 'm1',
    role: 'assistant',
    timestamp: '2026-11-19T00:00:00Z',
    content: texts.map((text) => ({ type: 'text' as const, text })),
  }
}

const MIXED = [
  '## Plan',
  'Run **npm test** and check `jest.config.js`.',
  '- first',
  '- second',
  '```ts',
  'const a = 1',
  '```',
].join('\n')

describe('messageText', () => {
  it('copies markdown source unchanged', () => {
    expect(messageMarkdown(msg(MIXED))).toBe(MIXED)
  })

  it('joins several text blocks and skips non-text blocks', () => {
    const m = msg('one', 'two')
    m.content.splice(1, 0, { type: 'tool_use', name: 'Bash', input: {} })
    expect(messageMarkdown(m)).toBe('one\n\ntwo')
  })

  it('strips markers but keeps list glyphs and code', () => {
    expect(messagePlainText(msg(MIXED))).toBe(
      ['Plan', 'Run npm test and check jest.config.js.', '• first', '• second', 'const a = 1'].join('\n'),
    )
  })

  it('copies a table as tab-separated rows without the pipes or delimiter row', () => {
    const table = '| Name | Qty |\n|:--|--:|\n| **apples** | 3 |\n| pears | 12 |'
    expect(messagePlainText(msg(table))).toBe('Name\tQty\napples\t3\npears\t12')
  })

  it('collects every fenced code body', () => {
    const text = '```js\nfoo()\n```\nbetween\n```\nbar()\n```'
    expect(messageCodeBlocks(msg(text))).toBe('foo()\n\nbar()')
  })

  it('returns no code for prose', () => {
    expect(messageCodeBlocks(msg('just words with `inline`'))).toBe('')
  })

  it('quotes every line', () => {
    expect(quoteAsMarkdown('a\nb')).toBe('> a\n> b')
  })
})

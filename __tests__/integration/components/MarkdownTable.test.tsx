import { columnWidths } from '@/components/conversation/MarkdownTable'
import { parseBlocks } from '@/lib/markdown'

function tableOf(source: string) {
  const [block] = parseBlocks(source)
  if (block.kind !== 'table') throw new Error('not a table')
  return block
}

describe('columnWidths', () => {
  it('sizes each column to its longest cell, header included', () => {
    const t = tableOf('| id | description |\n|---|---|\n| 1 | a longer cell here |')
    const [id, description] = columnWidths(t.header, t.rows)
    expect(description).toBeGreaterThan(id)
  })

  it('gives a column the width of its longest row, not the first', () => {
    const t = tableOf('| h |\n|---|\n| x |\n| xxxxxxxxxxxxxxxx |')
    const short = tableOf('| h |\n|---|\n| x |')
    expect(columnWidths(t.header, t.rows)[0]).toBeGreaterThan(columnWidths(short.header, short.rows)[0])
  })

  it('never goes below a tappable minimum for an empty column', () => {
    const t = tableOf('| a |\n|---|\n|  |')
    expect(columnWidths(t.header, t.rows)[0]).toBeGreaterThanOrEqual(48)
  })

  it('caps a very long cell so it wraps instead of widening the grid without bound', () => {
    const t = tableOf(`| h |\n|---|\n| ${'word '.repeat(80)} |`)
    expect(columnWidths(t.header, t.rows)[0]).toBe(220)
  })

  it('measures a header-only table', () => {
    const t = tableOf('| alpha | b |\n|---|---|')
    expect(columnWidths(t.header, t.rows)).toHaveLength(2)
  })
})

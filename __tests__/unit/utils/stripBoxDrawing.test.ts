import { stripBoxDrawing } from '@/utils/stripBoxDrawing'

describe('stripBoxDrawing', () => {
  it('removes box-drawing border glyphs that stripAnsi leaves behind', () => {
    expect(stripBoxDrawing('╭─ Claude Code ─╮')).toBe('Claude Code')
    expect(stripBoxDrawing('│ hello world │')).toBe('hello world')
    expect(stripBoxDrawing('└────────────┘')).toBe('')
  })

  it('removes block-element glyphs (Clawd ASCII art)', () => {
    expect(stripBoxDrawing('▛▜▙▟███')).toBe('')
  })

  it('leaves ordinary text untouched (modulo whitespace collapse)', () => {
    expect(stripBoxDrawing('just normal text')).toBe('just normal text')
    expect(stripBoxDrawing('  spaced   out  ')).toBe('spaced out')
  })
})

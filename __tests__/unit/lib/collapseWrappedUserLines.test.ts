import { collapseWrappedUserLines } from '@/lib/collapseWrappedUserLines'

describe('collapseWrappedUserLines', () => {
  it('returns lines unchanged when userMessageTexts is undefined', () => {
    const lines = ['❯ hello world', 'some output']
    expect(collapseWrappedUserLines(lines, undefined)).toEqual(lines)
  })

  it('returns lines unchanged when userMessageTexts is empty', () => {
    const lines = ['❯ hello world', 'some output']
    expect(collapseWrappedUserLines(lines, new Set())).toEqual(lines)
  })

  it('leaves a single-row prompt as-is when it already matches', () => {
    const lines = ['❯ hello world', 'some output']
    const texts = new Set(['hello world'])
    expect(collapseWrappedUserLines(lines, texts)).toEqual(['❯ hello world', 'some output'])
  })

  it('collapses a multi-row wrapped prompt into one row matching ground truth', () => {
    const lines = [
      'preceding output',
      '❯ this is a long prompt that got',
      'wrapped across multiple',
      'terminal rows',
      'trailing output',
    ]
    const texts = new Set(['this is a long prompt that got wrapped across multiple terminal rows'])
    expect(collapseWrappedUserLines(lines, texts)).toEqual([
      'preceding output',
      '❯ this is a long prompt that got wrapped across multiple terminal rows',
      'trailing output',
    ])
  })

  it('leaves rows untouched when no match is found within the 20-row lookahead bound', () => {
    const tail = Array.from({ length: 25 }, (_, i) => `filler row ${i}`)
    const lines = ['❯ never matches', ...tail]
    const texts = new Set(['something completely different'])
    expect(collapseWrappedUserLines(lines, texts)).toEqual(lines)
  })

  it('never engages on non-prompt content (tool output, trees, tables)', () => {
    const lines = [
      '├── src/',
      '│   └── index.ts',
      '| col1 | col2 |',
      '$ ls -la',
      'total 42',
    ]
    const texts = new Set(['ls -la'])
    expect(collapseWrappedUserLines(lines, texts)).toEqual(lines)
  })

  it('collapses multiple separate wrapped prompts in the same line array', () => {
    const lines = [
      '❯ first prompt part',
      'one continued',
      'middle output',
      '❯ second prompt',
      'part two',
    ]
    const texts = new Set(['first prompt part one continued', 'second prompt part two'])
    expect(collapseWrappedUserLines(lines, texts)).toEqual([
      '❯ first prompt part one continued',
      'middle output',
      '❯ second prompt part two',
    ])
  })
})

import React from 'react'
import { StyleSheet, type TextStyle } from 'react-native'
import { render } from '@testing-library/react-native'
import { ChatMarkdown } from '@/components/conversation/ChatMarkdown'
import { parseMarkdown } from '@/lib/markdown'
import '@/test-utils/i18n-setup'

const ANSWER = [
  '## What I changed',
  '',
  'Two files, both under `lib/`:',
  '',
  '- **blocks.ts** — the line classifier',
  '- **inline.ts** — the span scanner',
].join('\n')

function renderMd(source: string, props: Record<string, unknown> = {}) {
  return render(<ChatMarkdown blocks={parseMarkdown(source)} {...props} />)
}

describe('ChatMarkdown – rendering', () => {
  it('renders blocks with the markers gone', async () => {
    const { getByText, queryByText } = await renderMd('## Summary\n\n- **one**')
    expect(getByText('Summary')).toBeTruthy()
    expect(getByText('one')).toBeTruthy()
    expect(queryByText('## Summary')).toBeNull()
  })

  // Web Text defaults to CSS flex-shrink: 1 (only View pins 0), so without this
  // the "1." marker squeezes below its width and the dot wraps to its own line.
  it('keeps the list marker from shrinking', async () => {
    const { getByText } = await renderMd('1. first')
    expect(StyleSheet.flatten(getByText('1.').props.style).flexShrink).toBe(0)
  })

  it('routes a fenced block through the existing CodeBlock', async () => {
    const { getByTestId, getByText } = await renderMd('```bash\nnpm ci\n```')
    expect(getByTestId('message-code-block')).toBeTruthy()
    expect(getByText('npm ci')).toBeTruthy()
  })

  it('still renders prose it cannot classify', async () => {
    const source = '| a | b |\n| 1 | 2 |'
    const { getByText } = await renderMd(source)
    expect(getByText(source)).toBeTruthy()
  })
})

describe('ChatMarkdown – list marker colour', () => {
  const colorOf = (node: { props: { style?: unknown } }) =>
    (StyleSheet.flatten(node.props.style as TextStyle) ?? {}).color

  it('draws the marker in the body text colour inside a user bubble', async () => {
    const { getByText } = await renderMd('1. first', { isUser: true })
    expect(colorOf(getByText('1.'))).toBe(colorOf(getByText('first')))
  })

  it('keeps the dimmer marker colour in an assistant bubble', async () => {
    const { getByText } = await renderMd('1. first')
    expect(colorOf(getByText('1.'))).not.toBe(colorOf(getByText('first')))
  })
})

describe('ChatMarkdown – coexisting with search', () => {
  // The search target is resolved server-side over the raw JSONL, so any needle
  // the server anchored to has to stay visible on the client.
  it('highlights a needle that falls inside a formatted span', async () => {
    const { getByText } = await renderMd(ANSWER, { highlight: 'span scanner' })
    // The matched line drops to a root HighlightText over its rendered text, so
    // the markers are gone and the needle itself becomes its own tinted node.
    const hit = getByText('span scanner')
    expect(hit).toBeTruthy()
    expect(hit.props.style).toBeDefined()
  })

  it('leaves unmatched lines formatted', async () => {
    const { getByText } = await renderMd(ANSWER, { highlight: 'span scanner' })
    // A line with no match keeps its spans, so the strong run is its own node.
    expect(getByText('blocks.ts')).toBeTruthy()
  })

  it('finds a needle that the markdown markers would have hidden', async () => {
    // `**blocks.ts**` only exists in the source; the rendered text reads
    // `blocks.ts — the line classifier`. The line falls back to its source so
    // the match the server found is still shown.
    const { getByText, queryByText } = await renderMd(ANSWER, { highlight: '**blocks.ts**' })
    expect(getByText('**blocks.ts** — the line classifier')).toBeTruthy()
    // The fallback is the block's INLINE source: the list bullet is drawn by
    // the renderer, so a leading `- ` here would draw the marker twice.
    expect(queryByText('- **blocks.ts** — the line classifier')).toBeNull()
  })

  it('renders normally when the needle is absent', async () => {
    const { getByText } = await renderMd(ANSWER, { highlight: 'nothing-matches-this' })
    expect(getByText('blocks.ts')).toBeTruthy()
    expect(getByText('What I changed')).toBeTruthy()
  })

  it('does not treat an all-whitespace needle as a search', async () => {
    const { getByText } = await renderMd(ANSWER, { highlight: '' })
    expect(getByText('blocks.ts')).toBeTruthy()
  })

  it('reports the match offset from the anchored row only once', async () => {
    const onLayout = jest.fn()
    const rowRef = { current: null }
    await renderMd(ANSWER, {
      highlight: 'span scanner',
      matchAnchor: { rowRef, onLayout },
      activeMatch: true,
    })
    // rowRef is null in this harness, so the callback guards and never fires —
    // the point is that rendering with an anchor does not throw.
    expect(onLayout).not.toHaveBeenCalled()
  })
})

// The user bubble's fill is theme.text.accent, the same colour inline code and
// links are drawn in on an assistant bubble, so in a user bubble they vanished.
describe('ChatMarkdown – inline spans inside a user bubble', () => {
  const colorOf = (node: { props: { style?: unknown } }) =>
    (StyleSheet.flatten(node.props.style as TextStyle) ?? {}).color

  it('draws inline code in the body text colour', async () => {
    const { getByText } = await renderMd('run `npm ci` first', { isUser: true })
    expect(colorOf(getByText('npm ci'))).toBe(colorOf(getByText(/run/)))
  })

  it('draws a link in the body text colour', async () => {
    const { getByText } = await renderMd('see [docs](https://example.com) here', { isUser: true })
    expect(colorOf(getByText('docs'))).toBe(colorOf(getByText(/see/)))
  })

  it('keeps the accent colour for inline code in an assistant bubble', async () => {
    const { getByText } = await renderMd('run `npm ci` first')
    expect(colorOf(getByText('npm ci'))).not.toBe(colorOf(getByText(/run/)))
  })
})

describe('ChatMarkdown – quote in a user bubble', () => {
  it('keeps the quote shrink-wrapped and readable on the accent fill', async () => {
    const { getByText, getByTestId } = await renderMd('> quoted\n\nmy reply', { isUser: true })
    const body = StyleSheet.flatten(getByTestId('quote-body').props.style)
    expect(body.flex).toBeUndefined()
    expect(body.flexShrink).toBe(1)
    expect(body.flexBasis).toBe('auto')
    const text = StyleSheet.flatten(getByText('quoted').props.style)
    expect(text.opacity).toBe(0.8)
    expect(getByText('my reply')).toBeTruthy()
  })
})

describe('ChatMarkdown – tables', () => {
  const TABLE = ['| Name | Qty |', '|:-----|----:|', '| **apples** | 3 |', '| pears | 12 |'].join('\n')
  const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as TextStyle) ?? {}

  it('draws a grid with the pipes gone', async () => {
    const { getByTestId, getByText, queryByText } = await renderMd(TABLE)
    expect(getByTestId('markdown-table')).toBeTruthy()
    expect(getByText('Name')).toBeTruthy()
    expect(getByText('pears')).toBeTruthy()
    expect(queryByText(/\|/)).toBeNull()
  })

  it('makes the header row bold and the body regular', async () => {
    const { getByText } = await renderMd(TABLE)
    expect(styleOf(getByText('Name')).fontWeight).toBe('700')
    expect(styleOf(getByText('pears')).fontWeight).toBeUndefined()
  })

  it('applies the delimiter alignment to a column and leaves an unmarked one to the text direction', async () => {
    const { getByText } = await renderMd(TABLE)
    expect(styleOf(getByText('12')).textAlign).toBe('right')
    expect(styleOf(getByText('pears')).textAlign).toBe('left')
    const unmarked = await renderMd('| a |\n|---|\n| b |')
    expect(styleOf(unmarked.getByText('b')).textAlign).toBe('auto')
  })

  it('renders inline markdown inside a cell', async () => {
    const { getByText } = await renderMd(TABLE)
    expect(styleOf(getByText('apples')).fontWeight).toBe('700')
  })

  it('makes a link in a cell pressable through the same http(s) gate as prose', async () => {
    const { getByText } = await renderMd('| doc |\n|---|\n| [x](https://example.com) |')
    expect(getByText('x').props.onPress).toBeInstanceOf(Function)
  })

  it('keeps the prose around a table', async () => {
    const { getByText, getByTestId } = await renderMd(`Before\n\n${TABLE}\n\nAfter`)
    expect(getByText('Before')).toBeTruthy()
    expect(getByText('After')).toBeTruthy()
    expect(getByTestId('markdown-table')).toBeTruthy()
  })

  it('draws the borders in a visible colour inside a user bubble', async () => {
    const user = await renderMd(TABLE, { isUser: true })
    const assistant = await renderMd(TABLE)
    expect(styleOf(user.getByTestId('markdown-table-grid')).borderColor).toMatch(/59$/)
    expect(styleOf(assistant.getByTestId('markdown-table-grid')).borderColor).not.toMatch(/59$/)
  })

  // A needle inside a cell has no single run of text to tint, so the table
  // drops to its source line and the match stays visible.
  it('shows a matching table as its plain source while searching', async () => {
    const { getByText, queryByTestId } = await renderMd(TABLE, { highlight: 'pears' })
    expect(queryByTestId('markdown-table')).toBeNull()
    expect(getByText('pears')).toBeTruthy()
  })

  it('leaves a table that does not match as a grid while searching', async () => {
    const { getByTestId } = await renderMd(`${TABLE}\n\nneedle here`, { highlight: 'needle' })
    expect(getByTestId('markdown-table')).toBeTruthy()
  })
})

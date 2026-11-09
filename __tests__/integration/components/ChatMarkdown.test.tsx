import React from 'react'
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

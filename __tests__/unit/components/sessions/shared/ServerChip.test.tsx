import { act } from 'react'
import renderer from 'react-test-renderer'
import { ServerChip } from '@/components/sessions/shared/ServerChip'

type Json = null | string | { type?: string; props?: Record<string, unknown>; children?: Json[] | null }

function collectText(node: Json): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (!node.children) return ''
  return node.children.map(collectText).join('')
}

function makeTree(element: React.ReactElement) {
  let r: renderer.ReactTestRenderer | null = null
  act(() => {
    r = renderer.create(element)
  })
  return r!
}

describe('ServerChip', () => {
  it('label variant renders the server name', () => {
    const tree = makeTree(<ServerChip label="tb-streamer" color="#63b3ff" />)
    expect(collectText(tree.toJSON() as unknown as Json)).toBe('tb-streamer')
  })

  it('label variant truncates with an ellipsis past maxLabelChars', () => {
    const tree = makeTree(
      <ServerChip label="this-is-a-very-long-server-name" color="#63b3ff" maxLabelChars={10} />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text.length).toBeLessThanOrEqual(10)
    expect(text.endsWith('…')).toBe(true)
  })

  it('letter variant renders 2-letter initials', () => {
    const tree = makeTree(<ServerChip label="tb-streamer" variant="letter" color="#63b3ff" />)
    expect(collectText(tree.toJSON() as unknown as Json)).toBe('TS')
  })

  it('symbol variant renders an empty tile (icon supplied externally)', () => {
    const tree = makeTree(<ServerChip label="tb-streamer" variant="symbol" color="#63b3ff" />)
    expect(collectText(tree.toJSON() as unknown as Json)).toBe('')
  })

  it('falls back to brand blue when no color is provided', () => {
    const tree = makeTree(<ServerChip label="x" />)
    const json = JSON.stringify(tree.toJSON())
    expect(json).toContain('#63b3ff')
  })

  it('attaches an accessible label "Server: <name>"', () => {
    const tree = makeTree(<ServerChip label="tb-streamer" color="#63b3ff" />)
    const json = JSON.stringify(tree.toJSON())
    expect(json).toContain('Server: tb-streamer')
  })
})

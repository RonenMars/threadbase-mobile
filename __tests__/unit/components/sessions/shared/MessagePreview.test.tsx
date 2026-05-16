import { act } from 'react'
import renderer from 'react-test-renderer'
import { MessagePreview } from '@/components/sessions/shared/MessagePreview'

type Json = null | string | { children?: Json[] | null }

function collectText(node: Json): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (!node.children) return ''
  return node.children.map(collectText).join('')
}

function rendered(element: React.ReactElement): string {
  let tree: renderer.ReactTestRenderer | null = null
  act(() => {
    tree = renderer.create(element)
  })
  return collectText(tree!.toJSON() as unknown as Json)
}

describe('MessagePreview', () => {
  it('renders firstMessage when mode is "first"', () => {
    const out = rendered(
      <MessagePreview mode="first" firstMessage={{ text: 'fix the metro path resolution' }} />,
    )
    expect(out).toContain('fix the metro path resolution')
  })

  it('renders lastMessage when mode is "last"', () => {
    const out = rendered(
      <MessagePreview mode="last" lastMessage={{ text: "I've updated metro.config.js" }} />,
    )
    expect(out).toContain("I've updated metro.config.js")
  })

  it('auto: short conversation prefers firstMessage', () => {
    const out = rendered(
      <MessagePreview
        mode="auto"
        messageCount={2}
        firstMessage={{ text: 'first' }}
        lastMessage={{ text: 'last' }}
      />,
    )
    expect(out).toBe('first')
  })

  it('auto: long conversation prefers lastMessage', () => {
    const out = rendered(
      <MessagePreview
        mode="auto"
        messageCount={50}
        firstMessage={{ text: 'first' }}
        lastMessage={{ text: 'last' }}
      />,
    )
    expect(out).toBe('last')
  })

  it('falls back to preview when first/last missing', () => {
    const out = rendered(<MessagePreview preview="summary from the server" />)
    expect(out).toBe('summary from the server')
  })

  it('falls back to lastOutput as the lowest tier', () => {
    const out = rendered(<MessagePreview lastOutput="zsh: command not found" />)
    expect(out).toBe('zsh: command not found')
  })

  it('returns null when nothing to render', () => {
    let r: renderer.ReactTestRenderer | null = null
    act(() => {
      r = renderer.create(<MessagePreview />)
    })
    expect(r!.toJSON()).toBeNull()
  })

  it('returns null when mode is "none" even with data', () => {
    let r: renderer.ReactTestRenderer | null = null
    act(() => {
      r = renderer.create(
        <MessagePreview mode="none" firstMessage={{ text: 'x' }} preview="y" lastOutput="z" />,
      )
    })
    expect(r!.toJSON()).toBeNull()
  })

  it('truncates with an ellipsis when text exceeds maxChars', () => {
    const long = 'a'.repeat(120)
    const out = rendered(<MessagePreview firstMessage={{ text: long }} maxChars={20} />)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out.endsWith('…')).toBe(true)
  })

  it('collapses internal whitespace and strips newlines', () => {
    const out = rendered(
      <MessagePreview firstMessage={{ text: 'line one\n\n  line   two\nline three' }} />,
    )
    expect(out).toBe('line one line two line three')
  })

  it('highlights case-insensitive search matches', () => {
    let tree: renderer.ReactTestRenderer | null = null
    act(() => {
      tree = renderer.create(
        <MessagePreview firstMessage={{ text: 'fix the Metro bundler crash' }} highlight="metro" />,
      )
    })
    const json = JSON.stringify(tree!.toJSON())
    expect(json).toContain('Metro') // original case preserved
    expect(
      rendered(
        <MessagePreview firstMessage={{ text: 'fix the Metro bundler crash' }} highlight="metro" />,
      ),
    ).toBe('fix the Metro bundler crash')
  })
})

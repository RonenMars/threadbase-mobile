import { act } from 'react'
import renderer from 'react-test-renderer'
import { MessagePreview, pickMatch } from '@/components/sessions/shared/MessagePreview'

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

/**
 * Text of the emphasised spans only. Highlighted parts are nested <Text> nodes
 * inside the outer preview <Text>; plain parts are bare strings.
 */
function highlighted(element: React.ReactElement): string[] {
  let tree: renderer.ReactTestRenderer | null = null
  act(() => {
    tree = renderer.create(element)
  })
  const root = tree!.toJSON() as { children?: unknown[] } | null
  return (root?.children ?? [])
    .filter((c): c is { children?: Json[] } => typeof c === 'object' && c != null)
    .map((c) => collectText(c as Json))
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

  describe('search matches', () => {
    it('renders the content snippet in place of first/last/preview', () => {
      const out = rendered(
        <MessagePreview
          lastMessage={{ text: 'generic tail message' }}
          preview="server summary"
          matches={[{ field: 'content', snippet: 'reconnect timeout was not cleared', highlights: [{ start: 10, end: 17 }] }]}
        />,
      )
      expect(out).toBe('reconnect timeout was not cleared')
    })

    it('emphasises the given ranges, not the query length', () => {
      // FTS ranges follow token boundaries: searching "timeout" hits "timeoutMs".
      const parts = highlighted(
        <MessagePreview
          highlight="timeout"
          matches={[{ field: 'content', snippet: 'cleared the timeoutMs handle', highlights: [{ start: 12, end: 21 }] }]}
        />,
      )
      expect(parts).toEqual(['timeoutMs'])
    })

    it('renders every range in one snippet', () => {
      const parts = highlighted(
        <MessagePreview
          matches={[{
            field: 'content',
            snippet: '…socket close then socket reopen…',
            highlights: [{ start: 1, end: 7 }, { start: 19, end: 25 }],
          }]}
        />,
      )
      expect(parts).toEqual(['socket', 'socket'])
    })

    it('renders a metadata hit plain when highlights are absent', () => {
      const el = (
        <MessagePreview matches={[{ field: 'gitBranch', snippet: 'feat/reconnect-timeout' }]} />
      )
      expect(rendered(el)).toBe('feat/reconnect-timeout')
      expect(highlighted(el)).toEqual([])
    })

    it('prefers the content match over a metadata match listed first', () => {
      const out = rendered(
        <MessagePreview
          matches={[
            { field: 'projectName', snippet: 'tb-mobile' },
            { field: 'content', snippet: 'the body hit', highlights: [{ start: 4, end: 8 }] },
          ]}
        />,
      )
      expect(out).toBe('the body hit')
    })

    it('collapses newlines inside a snippet without shifting offsets', () => {
      const el = (
        <MessagePreview
          matches={[{ field: 'content', snippet: 'first line\n\n  socket   closed', highlights: [{ start: 14, end: 20 }] }]}
        />
      )
      expect(rendered(el)).toBe('first line socket closed')
      expect(highlighted(el)).toEqual(['socket'])
    })

    it('drops out-of-range, inverted and overlapping ranges but keeps the snippet', () => {
      const el = (
        <MessagePreview
          matches={[{
            field: 'content',
            snippet: 'socket closed',
            highlights: [
              { start: 0, end: 6 },
              { start: 3, end: 9 },
              { start: 99, end: 120 },
              { start: 8, end: 2 },
            ],
          }]}
        />
      )
      expect(rendered(el)).toBe('socket closed')
      expect(highlighted(el)).toEqual(['socket'])
    })

    it('clamps a range that runs past the end of the snippet', () => {
      const parts = highlighted(
        <MessagePreview matches={[{ field: 'content', snippet: 'socket', highlights: [{ start: 0, end: 99 }] }]} />,
      )
      expect(parts).toEqual(['socket'])
    })

    it('falls back to the normal preview when no match is usable', () => {
      const out = rendered(
        <MessagePreview
          preview="server summary"
          matches={[{ field: 'content', snippet: '   ' }]}
        />,
      )
      expect(out).toBe('server summary')
    })

    it('mode "none" suppresses the snippet too', () => {
      let r: renderer.ReactTestRenderer | null = null
      act(() => {
        r = renderer.create(
          <MessagePreview mode="none" matches={[{ field: 'content', snippet: 'body hit' }]} />,
        )
      })
      expect(r!.toJSON()).toBeNull()
    })
  })
})

/**
 * The merged conversation card (app/index.tsx) calls pickMatch to decide whether
 * a row is a search hit. Its generic path renders one truncated line, so the
 * card only swaps in MessagePreview when there is really a snippet to show.
 */
describe('pickMatch', () => {
  it('returns null when there is nothing usable to render', () => {
    expect(pickMatch(undefined)).toBeNull()
    expect(pickMatch(null)).toBeNull()
    expect(pickMatch([])).toBeNull()
    expect(pickMatch([{ field: 'content', snippet: '   ' }])).toBeNull()
  })

  it('prefers a content hit over a metadata hit listed first', () => {
    const picked = pickMatch([
      { field: 'projectName', snippet: 'tb-mobile' },
      { field: 'content', snippet: 'the body hit' },
    ])
    expect(picked?.field).toBe('content')
  })

  it('still returns a metadata hit when that is all there is', () => {
    expect(pickMatch([{ field: 'gitBranch', snippet: 'feat/x' }])?.field).toBe('gitBranch')
  })
})

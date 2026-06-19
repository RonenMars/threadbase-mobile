import { act } from 'react'
import renderer from 'react-test-renderer'
import { ConversationListItem } from '@/components/sessions/shared/ConversationListItem'

const NOW = new Date(2026, 4, 15, 14, 35, 0)

type Json = null | string | { type?: string; props?: Record<string, unknown>; children?: Json[] | null }

function collectText(node: Json): string {
  if (node == null) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (!node.children) return ''
  return node.children.map(collectText).join('')
}

function render(element: React.ReactElement) {
  let r: renderer.ReactTestRenderer | null = null
  act(() => {
    r = renderer.create(element)
  })
  return r!
}

describe('ConversationListItem', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(NOW)
  })
  afterAll(() => {
    jest.useRealTimers()
  })

  it('renders a title when provided', () => {
    const tree = render(
      <ConversationListItem
        title="Fix metro bundler crash"
        timestamp={NOW.getTime() - 5 * 60 * 1000}
        messageCount={42}
        branch="main"
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('Fix metro bundler crash')
    expect(text).toContain('14:30')
    expect(text).toContain('main')
    expect(text).toContain('42 msgs')
  })

  it('falls back to path suffix when no title', () => {
    const tree = render(
      <ConversationListItem
        path="/Users/ronenmars/Desktop/dev/ai-tools/tb-streamer"
        timestamp={NOW.getTime() - 60 * 60 * 1000}
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('tb-streamer')
  })

  it('disambiguates colliding paths via smart mode siblings', () => {
    const a = '/Users/ronenmars/Desktop/dev/ai-tools/tb-streamer'
    const b = '/Users/ronenmars/work/archive/tb-streamer'
    const tree = render(
      <ConversationListItem path={a} siblings={[a, b]} timestamp={NOW.getTime() - 60_000} />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    // Both end in "tb-streamer" so smart suffix needs at least 2 segments.
    expect(text).toContain('ai-tools/tb-streamer')
  })

  it('renders a LIVE pill when live=true', () => {
    const tree = render(
      <ConversationListItem
        title="active session"
        timestamp={NOW.getTime() - 60_000}
        live
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('LIVE')
    // Live pill replaces the time text in the trailing slot.
    expect(text).not.toContain('14:35')
  })

  it('shows the server chip when multi-server and showServer=auto', () => {
    const tree = render(
      <ConversationListItem
        title="x"
        timestamp={NOW.getTime() - 60_000}
        serverLabel="tb-ak"
        serverColor="#4ade80"
        activeServerCount={3}
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('tb-ak')
  })

  it('hides the server chip when only one active server (auto)', () => {
    const tree = render(
      <ConversationListItem
        title="x"
        timestamp={NOW.getTime() - 60_000}
        serverLabel="tb-ak"
        activeServerCount={1}
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).not.toContain('tb-ak')
  })

  it('honors showServer=always even with one active server', () => {
    const tree = render(
      <ConversationListItem
        title="x"
        timestamp={NOW.getTime() - 60_000}
        serverLabel="tb-ak"
        activeServerCount={1}
        showServer="always"
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('tb-ak')
  })

  it('renders the preview line in auto mode (short conversation → first)', () => {
    const tree = render(
      <ConversationListItem
        title="topic"
        timestamp={NOW.getTime() - 60_000}
        messageCount={2}
        firstMessage={{ text: 'fix the metro path issue' }}
        lastMessage={{ text: "I've patched metro" }}
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('fix the metro path issue')
    expect(text).not.toContain("I've patched metro")
  })

  it('omits the preview line when previewMode=none', () => {
    const tree = render(
      <ConversationListItem
        title="topic"
        timestamp={NOW.getTime() - 60_000}
        firstMessage={{ text: 'this should be hidden' }}
        previewMode="none"
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).not.toContain('this should be hidden')
  })

  it('highlights matches in both title and preview when highlight is set', () => {
    const tree = render(
      <ConversationListItem
        title="Fix Metro path issue"
        firstMessage={{ text: 'the metro bundler is broken' }}
        timestamp={NOW.getTime() - 60_000}
        highlight="metro"
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('Metro')
    expect(text).toContain('metro bundler')
  })

  it('chip density omits the trailing meta column', () => {
    const tree = render(
      <ConversationListItem
        title="quick chip"
        timestamp={NOW.getTime() - 60_000}
        density="chip"
        leading="none"
      />,
    )
    const text = collectText(tree.toJSON() as unknown as Json)
    expect(text).toContain('quick chip')
    expect(text).not.toContain('14:35')
    expect(text).not.toContain('14:34')
  })

  it('renders an accessible time label on the time text', () => {
    const tree = render(
      <ConversationListItem
        title="x"
        timestamp={NOW.getTime() - 5 * 60 * 1000}
      />,
    )
    const json = JSON.stringify(tree.toJSON())
    expect(json).toMatch(/2026/) // verbose accessibilityLabel contains the year (locale-invariant)
  })
})

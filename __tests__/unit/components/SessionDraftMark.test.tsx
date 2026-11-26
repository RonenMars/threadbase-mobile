import { act } from 'react'
import { I18nextProvider } from 'react-i18next'
import renderer from 'react-test-renderer'
import { SessionDraftMark } from '@/components/sessions/shared/SessionDraftMark'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useDraftsStore } from '@/stores/drafts'
import i18n from '@/test-utils/i18n-setup'

jest.mock('@/services/secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}))

const mounted: renderer.ReactTestRenderer[] = []

function mount(serverId = 'srv', sessionId = 'a') {
  let tree: renderer.ReactTestRenderer | undefined
  act(() => {
    tree = renderer.create(
      <ThemeProvider>
        <I18nextProvider i18n={i18n}>
          <SessionDraftMark serverId={serverId} sessionId={sessionId} />
        </I18nextProvider>
      </ThemeProvider>,
    )
  })
  if (tree === undefined) throw new Error('renderer produced no tree')
  mounted.push(tree)
  return tree
}

interface MarkNode {
  props: { testID?: string; accessibilityLabel?: string }
}

function mark(tree: renderer.ReactTestRenderer): MarkNode[] {
  const root = tree.root as { findAll: (predicate: (node: MarkNode) => boolean) => MarkNode[] }
  return root.findAll((n) => n.props.testID === 'session-draft-mark-a')
}

beforeEach(() => {
  useDraftsStore.setState({ drafts: {} })
})

afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()))
})

describe('SessionDraftMark', () => {
  it('shows the mark, labelled "Unsent draft", when the session has a draft', () => {
    useDraftsStore.setState({ drafts: { 'srv::a': 'fix the bug' } })
    const found = mark(mount())
    expect(found.length).toBeGreaterThan(0)
    expect(found[0].props.accessibilityLabel).toBe('Unsent draft')
  })

  it.each([
    ['no draft', undefined],
    ['an empty draft', ''],
    ['a whitespace-only draft', '   \n'],
  ])('renders nothing for %s', (_name, text) => {
    if (text !== undefined) useDraftsStore.setState({ drafts: { 'srv::a': text } })
    expect(mark(mount())).toHaveLength(0)
  })

  it('appears and disappears while mounted as the draft changes', () => {
    const tree = mount()
    expect(mark(tree)).toHaveLength(0)
    act(() => useDraftsStore.getState().setDraft('srv', 'a', 'hello'))
    expect(mark(tree).length).toBeGreaterThan(0)
    act(() => useDraftsStore.getState().clearDraft('srv', 'a'))
    expect(mark(tree)).toHaveLength(0)
  })

  it("ignores another session's draft", () => {
    const tree = mount()
    act(() => useDraftsStore.getState().setDraft('srv', 'b', 'hello'))
    expect(mark(tree)).toHaveLength(0)
  })
})

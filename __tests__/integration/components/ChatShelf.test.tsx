import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router'
import { ChatShelf } from '@/components/shelf/ChatShelf'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useNavLockStore } from '@/stores/navLock'
import { useQuickAccessStore, type FavoriteItem } from '@/stores/quickAccess'
import type { MultiSession } from '@/types/api'

const sessionFav: FavoriteItem = { type: 'session', id: 'srv::session::s1', label: 'Saved session', serverId: 'srv', sessionId: 's1' }
const convFav: FavoriteItem = { type: 'conversation', id: 'srv::conversation::c1', label: 'Saved conversation', serverId: 'srv', conversationId: 'c1' }

function renderShelf(qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })) {
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <ChatShelf />
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

describe('ChatShelf', () => {
  let push: jest.Mock

  beforeEach(() => {
    push = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ push })
    ;(useSegments as jest.Mock).mockReturnValue([])
    ;(useGlobalSearchParams as jest.Mock).mockReturnValue({})
    useQuickAccessStore.setState({ favoritesEnabled: true, favorites: [convFav, sessionFav], shelfPosition: null })
    useNavLockStore.getState().clear()
  })

  afterEach(() => useNavLockStore.getState().clear())

  it('renders nothing without saved items, with favorites off, or on onboarding and pairing', async () => {
    const expectHidden = async () => {
      const screen = await renderShelf()
      expect(screen.queryByTestId('chat-shelf-bubble')).toBeNull()
      await screen.unmount()
    }

    useQuickAccessStore.setState({ favorites: [] })
    await expectHidden()

    useQuickAccessStore.setState({ favorites: [sessionFav], favoritesEnabled: false })
    await expectHidden()

    useQuickAccessStore.setState({ favoritesEnabled: true })
    for (const segment of ['onboarding', 'pair']) {
      ;(useSegments as jest.Mock).mockReturnValue([segment])
      await expectHidden()
    }
  })

  it('badges saved sessions that need the user and lists them first', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    qc.setQueryData(['sessions-eager', 'x'], [
      { id: 's1', serverId: 'srv', status: 'waiting_input', ptyAttached: true, ownership: 'managed', projectName: 'p' } as MultiSession,
    ])
    const screen = await renderShelf(qc)
    expect(screen.getByTestId('chat-shelf-badge')).toHaveTextContent('1')

    await fireEvent(screen.getByTestId('chat-shelf-bubble'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } })
    const rows = screen.getAllByTestId(/^chat-shelf-row-srv::/)
    expect(rows.map((r) => r.props.testID)).toEqual(['chat-shelf-row-srv::session::s1', 'chat-shelf-row-srv::conversation::c1'])
  })

  it('opens a saved session from the panel: locks navigation and pushes the session route', async () => {
    const screen = await renderShelf()
    await fireEvent(screen.getByTestId('chat-shelf-bubble'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } })
    expect(screen.getByTestId('chat-shelf-panel')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('chat-shelf-row-srv::session::s1'))
    expect(useNavLockStore.getState().isNavigating).toBe(true)
    expect(push).toHaveBeenCalledWith('/session/s1?server=srv')
    expect(screen.queryByTestId('chat-shelf-panel')).toBeNull()
  })

  it('opens a saved conversation through conversationHref', async () => {
    const screen = await renderShelf()
    await fireEvent(screen.getByTestId('chat-shelf-bubble'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } })
    await fireEvent.press(screen.getByTestId('chat-shelf-row-srv::conversation::c1'))
    expect(push).toHaveBeenCalledWith('/conversation/c1?server=srv')
  })

  it('shows the empty state when only directories are saved', async () => {
    useQuickAccessStore.setState({ favorites: [{ type: 'dir', id: '~/code', label: '~/code' }] })
    const screen = await renderShelf()
    await fireEvent(screen.getByTestId('chat-shelf-bubble'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } })
    expect(screen.getByTestId('chat-shelf-empty')).toBeTruthy()
    await fireEvent.press(screen.getByTestId('chat-shelf-close'))
    expect(screen.queryByTestId('chat-shelf-panel')).toBeNull()
  })

  it('long-press on a conversation screen saves it through pinItem, and again removes it', async () => {
    ;(useSegments as jest.Mock).mockReturnValue(['conversation', '[id]'])
    ;(useGlobalSearchParams as jest.Mock).mockReturnValue({ id: 'c2', server: 'srv' })
    const screen = await renderShelf()
    const longPress = () =>
      fireEvent(screen.getByTestId('chat-shelf-bubble'), 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } })

    await longPress()
    expect(useQuickAccessStore.getState().favorites.at(-1)).toEqual({
      type: 'conversation', id: 'srv::conversation::c2', label: 'c2', serverId: 'srv', conversationId: 'c2',
    })
    await longPress()
    expect(useQuickAccessStore.getState().favorites.some((f) => f.id === 'srv::conversation::c2')).toBe(false)
  })

  it('long-press elsewhere changes nothing', async () => {
    ;(useSegments as jest.Mock).mockReturnValue(['session', 'new'])
    ;(useGlobalSearchParams as jest.Mock).mockReturnValue({ id: 'x', server: 'srv' })
    const screen = await renderShelf()
    await fireEvent(screen.getByTestId('chat-shelf-bubble'), 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } })
    expect(useQuickAccessStore.getState().favorites).toEqual([convFav, sessionFav])
  })
})

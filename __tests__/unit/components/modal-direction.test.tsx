/**
 * Modal subtrees carry their own direction.
 *
 * React Native renders `<Modal>` children into `RCTModalHostView`, a separate
 * native host whose Yoga root direction comes from `I18nManager` — RN's own
 * Modal.js even freezes `const side = I18nManager.getConstants().isRTL ? 'right' : 'left'`
 * at module load. So the `direction` style painted on the app root in
 * app/_layout.tsx cannot reach them, and each modal composes
 * `useDirectionStyle()` onto its outermost view instead.
 *
 * These two are structurally different on purpose — ServersStatusModal is a
 * backdrop-wrapping-sheet modal, SlashCommandBoard is a backdrop-and-sheet
 * sibling pair — so between them they cover both shapes in the sweep.
 */
import React from 'react'
import { I18nManager, StyleSheet } from 'react-native'
import { cleanup } from '@testing-library/react-native'
import { ServersStatusModal } from '@/components/servers/ServersStatusModal'
import { SlashCommandBoard } from '@/components/shared/SlashCommandBoard'
import { wsManager } from '@/services/ws-client'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import i18n from '@/test-utils/i18n-setup'

const SERVER_ID = 'local'

function setNativeRTL(value: boolean) {
  Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value })
}

beforeEach(async () => {
  await cleanup()
  await i18n.changeLanguage('en')
  setNativeRTL(false)
  useServersStore.setState({
    servers: {
      [SERVER_ID]: {
        id: SERVER_ID,
        url: 'http://localhost:7071',
        label: 'localhost',
        apiKey: 'test',
        isConnected: false,
        serverInfo: null,
        connectionError: 'offline',
      },
    },
    activeServerIds: [SERVER_ID],
    displayedServerIds: [SERVER_ID],
  })
  useServerFetchStatusStore.setState({
    statuses: {
      [SERVER_ID]: { status: 'error', error: 'offline', lastCheckedAt: Date.now() },
    },
  })
  jest.spyOn(wsManager, 'status').mockReturnValue('disconnected')
  jest.spyOn(wsManager, 'onAnyStatusChange').mockReturnValue(() => {})
})

afterEach(async () => {
  jest.restoreAllMocks()
  await i18n.changeLanguage('en')
  setNativeRTL(false)
})

describe('modal direction follows i18next, not native RTL state', () => {
  it.each([
    ['en', 'ltr', true],
    ['he', 'rtl', false],
    ['ar', 'rtl', false],
    ['ru', 'ltr', true],
  ] as const)(
    'ServersStatusModal renders %s content %s while I18nManager.isRTL is %s',
    async (locale, expected, nativeIsRTL) => {
      await i18n.changeLanguage(locale)
      setNativeRTL(nativeIsRTL)

      const { getByText } = await renderWithI18n(
        <ServersStatusModal visible onClose={() => {}} />,
      )

      // Walk up from a leaf to the modal's outermost view and read its direction.
      let node = getByText('localhost').parent
      let direction: string | undefined
      while (node && direction === undefined) {
        direction = StyleSheet.flatten(node.props?.style)?.direction
        node = node.parent
      }

      expect(I18nManager.isRTL).toBe(nativeIsRTL)
      expect(direction).toBe(expected)
    },
  )

  it.each([
    ['en', 'ltr', true],
    ['he', 'rtl', false],
  ] as const)(
    'SlashCommandBoard renders %s content %s while I18nManager.isRTL is %s',
    async (locale, expected, nativeIsRTL) => {
      await i18n.changeLanguage(locale)
      setNativeRTL(nativeIsRTL)

      const screen = await renderWithI18n(
        <SlashCommandBoard visible query="compact" onSelect={() => {}} onDismiss={() => {}} />,
      )

      let node = screen.getByText('compact').parent
      let direction: string | undefined
      while (node && direction === undefined) {
        direction = StyleSheet.flatten(node.props?.style)?.direction
        node = node.parent
      }

      expect(I18nManager.isRTL).toBe(nativeIsRTL)
      expect(direction).toBe(expected)
    },
  )
})

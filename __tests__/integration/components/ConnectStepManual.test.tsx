import React from 'react'
import { StyleSheet } from 'react-native'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { ConnectStep } from '@/components/onboarding/steps/ConnectStep'
import { useTBPair } from '@/hooks/useTBPair'
import i18n from '@/test-utils/i18n-setup'

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}))

jest.mock('@/hooks/useTBPair', () => ({
  useTBPair: jest.fn(),
}))

const mockPair = jest.fn()
const mockReset = jest.fn()
const mockedUseTBPair = jest.mocked(useTBPair)

describe('ConnectStep – manual mode', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    mockPair.mockReset()
    mockReset.mockReset()
    mockedUseTBPair.mockReturnValue({
      phase: 'idle',
      log: [],
      error: null,
      pair: mockPair,
      reset: mockReset,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows "Type / paste manually" card in choose mode', async () => {
    const { getByText } = await render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    expect(getByText('Type / paste manually')).toBeTruthy()
  })

  it('shows "On your computer" section header in manual mode', async () => {
    const { getByText } = await render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    await fireEvent.press(getByText('Type / paste manually'))
    expect(getByText('On your computer')).toBeTruthy()
  })

  it('shows copyable tb-streamer pair command in manual mode', async () => {
    const { getByText } = await render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    await fireEvent.press(getByText('Type / paste manually'))
    expect(getByText(/tb-streamer pair/)).toBeTruthy()
  })

  it('renders copied status text with a separate Phosphor check icon', async () => {
    jest.useFakeTimers()
    const { getByTestId, getByText, queryByTestId, queryByText } = await render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    await fireEvent.press(getByText('Type / paste manually'))

    expect(queryByTestId('copy-command-copied-icon')).toBeNull()
    await fireEvent.press(getByTestId('copy-command-btn'))

    expect(getByText('copied')).toBeTruthy()
    expect(getByTestId('copy-command-copied-icon')).toBeTruthy()
    expect(queryByText(/✓/)).toBeNull()
  })

  it('shows "Server URL" and "Token" field labels (not faux-shell labels)', async () => {
    const { getByText, queryByText } = await render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    await fireEvent.press(getByText('Type / paste manually'))
    expect(getByText('Server URL')).toBeTruthy()
    expect(getByText('Token')).toBeTruthy()
    expect(queryByText(/\$ tb-streamer pair --server/)).toBeNull()
    expect(queryByText(/\$ tb-streamer pair --token/)).toBeNull()
  })

  it('CTA shows "Connect" not "Open handshake"', async () => {
    const { getByText, queryByText } = await render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )
    await fireEvent.press(getByText('Type / paste manually'))
    expect(getByText('Connect')).toBeTruthy()
    expect(queryByText('Open handshake')).toBeNull()
  })

  describe('confirm gate after paste', () => {
    async function fillAndConnect(
      onPaired: jest.Mock,
      onAdvance: jest.Mock,
    ) {
      mockPair.mockImplementation(
        ({ onSuccess }: { onSuccess?: (r: { url: string; apiKey: string }) => void }) => {
          onSuccess?.({ url: 'https://a.test', apiKey: 'tb_x' })
        },
      )
      const screen = await render(<ConnectStep onPaired={onPaired} onAdvance={onAdvance} />)
      await fireEvent.press(screen.getByText('Type / paste manually'))
      await fireEvent.changeText(
        screen.getByTestId('onboarding-connect-url-input'),
        '192.168.1.10:8766',
      )
      await fireEvent.changeText(
        screen.getByTestId('onboarding-connect-token-input'),
        'tb_df11da2b8b037fd61d82349d182a87b6',
      )
      await waitFor(() => {
        expect(screen.getByTestId('onboarding-connect-handshake-cta')).toBeEnabled()
      })
      await fireEvent.press(screen.getByTestId('onboarding-connect-handshake-cta'))
      return screen
    }

    it('shows the confirm gate after a successful paste pairing, before advancing', async () => {
      const onPaired = jest.fn()
      const onAdvance = jest.fn()
      const screen = await fillAndConnect(onPaired, onAdvance)

      expect(mockPair).toHaveBeenCalledTimes(1)
      expect(await screen.findByTestId('pair-confirm-add-btn')).toBeTruthy()
      expect(onPaired).not.toHaveBeenCalled()
      expect(onAdvance).not.toHaveBeenCalled()

      fireEvent.press(screen.getByTestId('pair-confirm-add-btn'))
      expect(onPaired).toHaveBeenCalledTimes(1)
      expect(onAdvance).toHaveBeenCalledTimes(1)
    })

    it('does not advance when the confirm gate is cancelled', async () => {
      const onPaired = jest.fn()
      const onAdvance = jest.fn()
      const screen = await fillAndConnect(onPaired, onAdvance)
      fireEvent.press(await screen.findByTestId('pair-confirm-cancel-btn'))

      expect(onPaired).not.toHaveBeenCalled()
      expect(onAdvance).not.toHaveBeenCalled()
      expect(mockReset).toHaveBeenCalledTimes(1)
    })
  })

  it('uses natural right-directed Hebrew connection copy', async () => {
    await i18n.changeLanguage('he')
    const { getByTestId, getByText } = await render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )

    expect(StyleSheet.flatten(getByTestId('onboarding-connect-root').props.style)).toEqual(
      expect.objectContaining({ direction: 'rtl' }),
    )
    for (const text of [
      '> 03 / חיבור',
      'חברו את המחשב.',
      'בחרו איך לחבר את Threadbase למחשב.',
      'הטלפון והמחשב צריכים להיות נגישים זה לזה — דרך אותה רשת Wi‑Fi, VPN כמו Tailscale או כתובת ציבורית.',
      'סריקת קוד QR',
      'הריצו tb-streamer pair במחשב וסרקו את הקוד. זו הדרך המהירה ביותר.',
      'הזנה ידנית',
    ]) {
      expect(StyleSheet.flatten(getByText(text).props.style)).toEqual(
        expect.objectContaining({
          direction: 'rtl',
          textAlign: 'auto',
          writingDirection: 'rtl',
        }),
      )
    }
  })

  it('uses natural Hebrew QR instructions and a right-pointing logical Back link', async () => {
    await i18n.changeLanguage('he')
    const { getByTestId, getByText, queryByTestId } = await render(
      <ConnectStep onPaired={jest.fn()} onAdvance={jest.fn()} />
    )

    await fireEvent.press(getByText('סריקת קוד QR'))

    expect(getByText('> 03 / חיבור · QR')).toBeTruthy()
    expect(getByText('סרקו את קוד ה־QR.')).toBeTruthy()
    expect(getByText('1. במחשב, הריצו tb-streamer pair. קוד QR יופיע בטרמינל.')).toBeTruthy()
    expect(getByText('2. לחצו על ״פתחו מצלמה״. Threadbase תבקש גישה למצלמה רק כדי לסרוק את הקוד.')).toBeTruthy()
    expect(getByText('3. כוונו את הטלפון לקוד. הטוקן תקף ל־3 דקות; אם פג תוקפו, הריצו שוב tb-streamer pair.')).toBeTruthy()
    expect(getByText('פתחו מצלמה')).toBeTruthy()
    expect(StyleSheet.flatten(getByTestId('onboarding-connect-back-to-choose').props.style)).toEqual(
      expect.objectContaining({ alignSelf: 'flex-start', direction: 'rtl' }),
    )
    expect(getByTestId('onboarding-connect-back-arrow-right')).toBeTruthy()
    expect(queryByTestId('onboarding-connect-back-arrow-left')).toBeNull()
  })
})

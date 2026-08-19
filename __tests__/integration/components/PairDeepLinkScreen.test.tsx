import React from 'react'
import { fireEvent, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as pairExchange from '@/services/pair-exchange'
import { useServersStore } from '@/stores/servers'
import { renderWithI18n } from '@/test-utils/render'
import PairDeepLinkScreen from '@/app/pair'

jest.mock('@/services/pair-exchange', () => {
  const actual = jest.requireActual<typeof import('@/services/pair-exchange')>(
    '@/services/pair-exchange',
  )
  return {
    ...actual,
    exchangeToken: jest.fn(),
    // Wraps the real parser rather than replacing it: the screen still parses
    // for real, and the call is recorded so a test can read what the rebuilt
    // URI actually carried. Spying on the module object does not work here —
    // the screen's import is bound directly, so the spy never sees the call.
    parsePairUri: jest.fn(actual.parsePairUri),
  }
})

jest.mock('@/services/pair-device-name', () => ({
  defaultPairDeviceName: () => 'Test Phone',
}))

const exchangeToken = pairExchange.exchangeToken as jest.MockedFunction<
  typeof pairExchange.exchangeToken
>
const parsePairUri = pairExchange.parsePairUri as jest.MockedFunction<
  typeof pairExchange.parsePairUri
>

const mockReplace = jest.fn()
const FUTURE_EXP = String(Math.floor(Date.now() / 1000) + 180)

async function confirmAndAdd() {
  const screen = await renderWithI18n(<PairDeepLinkScreen />)
  fireEvent.press(await screen.findByTestId('pair-confirm-add-btn'))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
  return screen
}

function setParams(params: {
  url?: string
  token?: string
  exp?: string
  spk?: string
  v?: string
}) {
  ;(useLocalSearchParams as jest.Mock).mockReturnValue(params)
}

beforeEach(() => {
  exchangeToken.mockReset()
  // Clear, not reset — reset would drop the real implementation it wraps.
  parsePairUri.mockClear()
  mockReplace.mockReset()
  ;(useRouter as jest.Mock).mockReturnValue({
    push: jest.fn(),
    replace: mockReplace,
    back: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  })
  useServersStore.setState({
    servers: {},
    activeServerIds: [],
    displayedServerIds: [],
    scanProgress: {},
  })
})

describe('PairDeepLinkScreen', () => {
  it('exchanges the token, adds the server, and lands on the hub', async () => {
    setParams({ url: 'https://example.test', token: 'pt_abc', exp: FUTURE_EXP })
    exchangeToken.mockResolvedValue({
      url: 'https://example.test',
      apiKey: 'tb_sealed',
      publicUrl: 'https://example.test',
      machineName: 'ronen-mac.local',
      deviceId: 'dev-1',
      deviceToken: 'dt_1',
      capabilities: null,
      serverPublicKey: null,
      e2eeRequired: false,
    })

    await confirmAndAdd()

    expect(exchangeToken).toHaveBeenCalledWith({
      url: 'https://example.test',
      token: 'pt_abc',
      deviceName: 'Test Phone',
    })
    const added = Object.values(useServersStore.getState().servers)
    expect(added).toHaveLength(1)
    expect(added[0].url).toBe('https://example.test')
    expect(added[0].apiKey).toBe('tb_sealed')
    expect(added[0].label).toBe('ronen-mac.local')
  })

  // Expo Router hands this screen loose query params, so it rebuilds the URI
  // from an allowlist before parsing. A parameter missing from that list is
  // dropped here and nowhere else, silently — the scanner and paste paths hand
  // parsePairUri the original string. Asserting on the parser's own return value
  // covers both halves at once: the rebuild kept `spk`, and the parse surfaced it.
  it('carries the server public key through the deep-link rebuild', async () => {
    const spk = 'B'.repeat(43)
    setParams({ url: 'https://example.test', token: 'pt_abc', exp: FUTURE_EXP, spk, v: '1' })
    exchangeToken.mockResolvedValue({
      url: 'https://example.test',
      apiKey: 'tb_sealed',
      publicUrl: 'https://example.test',
      machineName: 'ronen-mac.local',
      deviceId: 'dev-1',
      deviceToken: 'dt_1',
      capabilities: null,
      serverPublicKey: null,
      e2eeRequired: false,
    })

    const screen = await renderWithI18n(<PairDeepLinkScreen />)
    expect(await screen.findByTestId('identity-fingerprint')).toBeTruthy()
    expect(await screen.findByText('ronen-mac.local')).toBeTruthy()
    expect(Object.keys(useServersStore.getState().servers)).toHaveLength(0)
    fireEvent.press(await screen.findByTestId('pair-confirm-add-btn'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))

    expect(parsePairUri).toHaveBeenCalled()
    expect(parsePairUri.mock.results[0].value).toMatchObject({ spk, v: 1 })
    expect(exchangeToken).toHaveBeenCalledWith({
      url: 'https://example.test',
      token: 'pt_abc',
      deviceName: 'Test Phone',
      serverPublicKey: spk,
    })
  })

  // An older streamer sends no spk, and that must stay an ordinary pairing.
  it('pairs normally when the link carries no server public key', async () => {
    setParams({ url: 'https://example.test', token: 'pt_abc', exp: FUTURE_EXP })
    exchangeToken.mockResolvedValue({
      url: 'https://example.test',
      apiKey: 'tb_sealed',
      publicUrl: 'https://example.test',
      machineName: 'ronen-mac.local',
      deviceId: 'dev-1',
      deviceToken: 'dt_1',
      capabilities: null,
      serverPublicKey: null,
      e2eeRequired: false,
    })

    await confirmAndAdd()
    expect(Object.values(useServersStore.getState().servers)).toHaveLength(1)
  })

  it('shows a real error for an expired link, without exchanging', async () => {
    setParams({ url: 'https://example.test', token: 'pt_x', exp: '1' })

    const screen = await renderWithI18n(<PairDeepLinkScreen />)

    expect(
      await screen.findByText('This pair QR has expired. Run tb pair on your server again.'),
    ).toBeTruthy()
    expect(exchangeToken).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(screen.queryByTestId('pair-deep-link-try-again')).toBeNull()
    fireEvent.press(await screen.findByTestId('pair-deep-link-close'))
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('shows an invalid-link error when the url or token is missing', async () => {
    setParams({ token: 'pt_x' })

    const screen = await renderWithI18n(<PairDeepLinkScreen />)

    expect(
      await screen.findByText("That QR doesn't look like a Threadbase pair code."),
    ).toBeTruthy()
    expect(exchangeToken).not.toHaveBeenCalled()
    expect(screen.queryByTestId('pair-deep-link-try-again')).toBeNull()
    fireEvent.press(await screen.findByTestId('pair-deep-link-close'))
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('shows an already-added error when the server is already paired, without re-exchanging', async () => {
    useServersStore.setState({
      servers: {
        'srv-1': {
          id: 'srv-1',
          url: 'https://example.test',
          apiKey: 'existing-key',
          isConnected: false,
          serverInfo: null,
          connectionError: null,
        },
      },
      activeServerIds: ['srv-1'],
      displayedServerIds: ['srv-1'],
      scanProgress: {},
    })
    // Trailing slash on the incoming link; addServer's own normalisation
    // strips it, so this must still match the already-paired server.
    setParams({ url: 'https://example.test/', token: 'pt_abc', exp: FUTURE_EXP })

    const screen = await renderWithI18n(<PairDeepLinkScreen />)

    expect(await screen.findByTestId('pair-deep-link-already-added')).toBeTruthy()
    expect(
      await screen.findByText(
        'This address is already in your list. Delete that server first if you want to add it again.',
      ),
    ).toBeTruthy()
    expect(await screen.findByText('Server already added')).toBeTruthy()
    expect(screen.queryByTestId('pair-deep-link-try-again')).toBeNull()
    expect(screen.queryByTestId('pair-deep-link-support')).toBeNull()
    expect(exchangeToken).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(Object.keys(useServersStore.getState().servers)).toEqual(['srv-1'])

    fireEvent.press(await screen.findByTestId('pair-deep-link-close'))
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('does not add the server when the confirmation is cancelled', async () => {
    setParams({ url: 'https://example.test', token: 'pt_abc', exp: FUTURE_EXP })
    exchangeToken.mockResolvedValue({
      url: 'https://example.test',
      apiKey: 'tb_sealed',
      publicUrl: null,
      machineName: 'ronen-mac.local',
      deviceId: 'dev-1',
      deviceToken: 'dt_1',
      capabilities: null,
      serverPublicKey: null,
      e2eeRequired: false,
    })

    const screen = await renderWithI18n(<PairDeepLinkScreen />)
    fireEvent.press(await screen.findByTestId('pair-confirm-cancel-btn'))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
    expect(Object.keys(useServersStore.getState().servers)).toHaveLength(0)
  })

  it('shows a token-rejected error and lets the user retry', async () => {
    setParams({ url: 'https://example.test', token: 'pt_used', exp: FUTURE_EXP })
    exchangeToken.mockRejectedValueOnce(
      new pairExchange.PairExchangeError('token', 'Pair token rejected'),
    )

    const { findByText, findByTestId } = await renderWithI18n(<PairDeepLinkScreen />)

    expect(
      await findByText('Pair token rejected — generate a fresh QR on your server.'),
    ).toBeTruthy()
    expect(exchangeToken).toHaveBeenCalledTimes(1)
    // The error surface must stay put — this is the deep-link entry point,
    // so a navigation away here would render the error unseen (issue #597's
    // failure mode one layer down).
    expect(mockReplace).not.toHaveBeenCalled()

    exchangeToken.mockResolvedValueOnce({
      url: 'https://example.test',
      apiKey: 'tb_sealed_2',
      publicUrl: null,
      machineName: null,
      deviceId: null,
      deviceToken: null,
      capabilities: null,
      serverPublicKey: null,
      e2eeRequired: false,
    })
    fireEvent.press(await findByText('Try again'))
    fireEvent.press(await findByTestId('pair-confirm-add-btn'))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'))
    expect(exchangeToken).toHaveBeenCalledTimes(2)
  })

  it('shows a translated, actionable message for an unreachable host — never the raw exception', async () => {
    setParams({ url: 'https://example.test', token: 'pt_net', exp: FUTURE_EXP })
    exchangeToken.mockRejectedValueOnce(
      new pairExchange.PairExchangeError(
        'network',
        'fetch failed: UnexpectedException: Could not connect to the server. (at ExpoModulesCore/Promise.swift:56)',
      ),
    )

    const { findByText, queryByText } = await renderWithI18n(<PairDeepLinkScreen />)

    expect(
      await findByText(
        'Could not reach that server. Check that the streamer is running and your phone is on the same network.',
      ),
    ).toBeTruthy()
    expect(queryByText(/Promise\.swift/)).toBeNull()
    expect(queryByText(/UnexpectedException/)).toBeNull()
  })

  it('shows a translated message for an unexpected server response — never the raw status text', async () => {
    setParams({ url: 'https://example.test', token: 'pt_srv', exp: FUTURE_EXP })
    exchangeToken.mockRejectedValueOnce(
      new pairExchange.PairExchangeError('server', 'Server returned 500'),
    )

    const { findByText, queryByText } = await renderWithI18n(<PairDeepLinkScreen />)

    expect(
      await findByText(
        "The server responded unexpectedly. Update the streamer to the latest version and try again.",
      ),
    ).toBeTruthy()
    expect(queryByText(/Server returned 500/)).toBeNull()
  })

  it('refuses an empty server key instead of pairing in plaintext', async () => {
    setParams({ url: 'https://example.test', token: 'pt_abc', exp: FUTURE_EXP, spk: '' })

    const { findByText, queryByTestId } = await renderWithI18n(<PairDeepLinkScreen />)

    expect(
      await findByText(
        'The server key in this pairing code is damaged, so this pairing cannot be encrypted. Generate a fresh QR on your server.',
      ),
    ).toBeTruthy()
    expect(exchangeToken).not.toHaveBeenCalled()
    expect(queryByTestId('pair-deep-link-try-again')).toBeNull()
    expect(queryByTestId('pair-deep-link-close')).toBeTruthy()
  })

  it.each<[pairExchange.PairExchangeError['kind'], string]>([
    [
      'e2ee-version',
      'This server encrypts pairing in a version this app does not speak. Update the app and the streamer to matching versions.',
    ],
    [
      'e2ee-refused',
      'This server offered an encrypted pairing and then did not finish it. Generate a fresh pairing code on your server and scan it again.',
    ],
    [
      'e2ee-web-unsupported',
      'Encrypted pairing needs the Threadbase app for iOS or Android. A browser cannot store the key that identifies this device.',
    ],
  ])('shows %s without offering to retry the same link', async (kind, message) => {
    setParams({ url: 'https://example.test', token: 'pt_abc', exp: FUTURE_EXP, spk: 'B'.repeat(43) })
    exchangeToken.mockRejectedValueOnce(new pairExchange.PairExchangeError(kind, 'failed'))

    const { findByText, queryByTestId } = await renderWithI18n(<PairDeepLinkScreen />)

    expect(await findByText(message)).toBeTruthy()
    expect(queryByTestId('pair-deep-link-try-again')).toBeNull()
    expect(queryByTestId('pair-deep-link-close')).toBeTruthy()
    expect(queryByTestId('pair-deep-link-support')).toBeTruthy()
  })

  it('falls back to the generic translated message for an unrecognised error shape', async () => {
    setParams({ url: 'https://example.test', token: 'pt_x', exp: FUTURE_EXP })
    exchangeToken.mockRejectedValueOnce(new TypeError('Network request failed'))

    const { findByText, queryByText } = await renderWithI18n(<PairDeepLinkScreen />)

    expect(await findByText('Pairing failed.')).toBeTruthy()
    expect(queryByText(/Network request failed/)).toBeNull()
  })

  // OS-camera QR with the app closed mounts this screen as the only stack
  // entry. Back must go to the hub, not fire an unhandled GO_BACK.
  it('sends the header back to the hub when this is the only stack entry', async () => {
    const back = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
      replace: mockReplace,
      back,
      navigate: jest.fn(),
      setParams: jest.fn(),
      canGoBack: () => false,
    })
    setParams({ url: 'https://example.test', token: 'pt_x', exp: '1' })

    const screen = await renderWithI18n(<PairDeepLinkScreen />)
    fireEvent.press(await screen.findByTestId('screen-header-back-button'))

    expect(back).not.toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/')
  })
})

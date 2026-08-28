import { renderHook, act } from '@testing-library/react-native'
import { useTBPair } from '@/hooks/useTBPair'
import * as pairExchange from '@/services/pair-exchange'

jest.mock('@/services/pair-exchange', () => {
  const actual = jest.requireActual<typeof import('@/services/pair-exchange')>(
    '@/services/pair-exchange',
  )
  return {
    ...actual,
    exchangeToken: jest.fn(),
  }
})

jest.mock('@/services/pair-device-name', () => ({
  defaultPairDeviceName: () => 'Test Phone',
}))

const exchangeToken = pairExchange.exchangeToken as jest.MockedFunction<
  typeof pairExchange.exchangeToken
>

// React Native declares `__DEV__` as a bare `const`, not a property of
// globalThis, so it is neither assignable nor reachable via `global.__DEV__`.
// This alias is the narrowest way to flip it for the prod-path tests.
const globalWithDev = global as typeof global & { __DEV__: boolean }

describe('useTBPair (prod path)', () => {
  const prevDev = globalWithDev.__DEV__

  beforeEach(() => {
    jest.useFakeTimers()
    globalWithDev.__DEV__ = false
    exchangeToken.mockReset()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    globalWithDev.__DEV__ = prevDev
  })

  it('exchanges a pt_ pair token then returns the sealed api key', async () => {
    exchangeToken.mockResolvedValue({
      url: 'https://example.test',
      apiKey: 'tb_sealed_key',
      // Deliberately different from `url`: the hook must forward both without
      // confusing one for the other.
      publicUrl: 'https://tunnel.example.test',
      machineName: null,
      deviceId: 'dev-1',
      deviceToken: 'dt_1',
      capabilities: ['history:read', 'session:control'],
      serverPublicKey: null,
      e2eeRequired: false,
    })

    const onSuccess = jest.fn()
    const { result } = await renderHook(() => useTBPair())

    await act(() => {
      result.current.pair({
        url: 'https://example.test',
        token: 'pt_abcdef',
        onSuccess,
      })
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(exchangeToken).toHaveBeenCalledWith({
      url: 'https://example.test',
      token: 'pt_abcdef',
      deviceName: 'Test Phone',
      readOnly: false,
    })
    expect(global.fetch).not.toHaveBeenCalled()

    await act(() => {
      jest.advanceTimersByTime(2400)
    })

    expect(onSuccess).toHaveBeenCalledWith({
      url: 'https://example.test',
      apiKey: 'tb_sealed_key',
      label: undefined,
      deviceId: 'dev-1',
      deviceToken: 'dt_1',
      capabilities: ['history:read', 'session:control'],
      publicUrl: 'https://tunnel.example.test',
      serverPublicKey: undefined,
      requireEncryption: false,
    })
    expect(result.current.phase).toBe('ok')
  })

  it('parses a threadbase:// URI and exchanges its embedded token', async () => {
    exchangeToken.mockResolvedValue({
      url: 'https://from-uri.test',
      apiKey: 'tb_from_uri',
      publicUrl: 'https://tunnel.from-uri.test',
      machineName: null,
      deviceId: null,
      deviceToken: null,
      capabilities: null,
      serverPublicKey: null,
      e2eeRequired: false,
    })

    const onSuccess = jest.fn()
    const { result } = await renderHook(() => useTBPair())
    const uri =
      'threadbase://pair?url=https%3A%2F%2Ffrom-uri.test&token=pt_uri_tok'

    await act(() => {
      result.current.pair({ url: '', token: uri, onSuccess })
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(exchangeToken).toHaveBeenCalledWith({
      url: 'https://from-uri.test',
      token: 'pt_uri_tok',
      deviceName: 'Test Phone',
      readOnly: false,
    })

    await act(() => {
      jest.advanceTimersByTime(2400)
    })

    expect(onSuccess).toHaveBeenCalledWith({
      url: 'https://from-uri.test',
      apiKey: 'tb_from_uri',
      label: undefined,
      deviceId: undefined,
      deviceToken: undefined,
      capabilities: undefined,
      publicUrl: 'https://tunnel.from-uri.test',
      serverPublicKey: undefined,
      requireEncryption: false,
    })
  })

  it('Bearer-checks long-lived API keys via /api/profiles', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ([]),
    })

    const onSuccess = jest.fn()
    const { result } = await renderHook(() => useTBPair())

    await act(() => {
      result.current.pair({
        url: 'https://example.test',
        token: 'tb_df11da2b8b037fd61d82349d182a87b6',
        onSuccess,
      })
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(exchangeToken).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.test/api/profiles',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer tb_df11da2b8b037fd61d82349d182a87b6',
        },
      }),
    )

    await act(() => {
      jest.advanceTimersByTime(2400)
    })

    expect(onSuccess).toHaveBeenCalledWith({
      url: 'https://example.test',
      apiKey: 'tb_df11da2b8b037fd61d82349d182a87b6',
    })
  })

  it('surfaces the pair.json expired sentence for an expired paste link', async () => {
    const { result } = await renderHook(() => useTBPair())
    const uri = 'threadbase://pair?url=https%3A%2F%2Fexample.test&token=pt_x&exp=1'

    await act(() => {
      result.current.pair({ url: '', token: uri })
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(exchangeToken).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('err')
    expect(result.current.error).toBe(
      'This pair QR has expired. Run tb-streamer pair on your server again.',
    )
  })

  it('surfaces the pair.json token sentence when the exchange rejects the token', async () => {
    exchangeToken.mockRejectedValue(new pairExchange.PairExchangeError('token', 'Pair token rejected'))
    const { result } = await renderHook(() => useTBPair())

    await act(() => {
      result.current.pair({ url: 'https://example.test', token: 'pt_used' })
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.phase).toBe('err')
    expect(result.current.error).toBe(
      'Pair token rejected — generate a fresh QR on your server.',
    )
  })
})

// ── The pasted URI's server key reaches the exchange (#698 item 1) ───────────
//
// The paste path is the third pairing surface and the one with no camera: the
// user copies a `threadbase://` URI from the streamer's terminal output. Its
// `spk` selects the encrypted path exactly as the scanned one does, and until
// now no test asserted the hook forwards it. The existing `:99` case above
// passes a URI with no `spk` and asserts a call shape that omits the property,
// which an absent value satisfies either way — so it cannot see a deletion.
describe('useTBPair — the pasted URI server key', () => {
  const SPK = 'C'.repeat(43)
  const prevDev = globalWithDev.__DEV__

  beforeEach(() => {
    jest.useFakeTimers()
    globalWithDev.__DEV__ = false
    exchangeToken.mockReset()
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    globalWithDev.__DEV__ = prevDev
  })

  it('forwards the pasted server key and reports the pairing as encrypted', async () => {
    exchangeToken.mockResolvedValue({
      url: 'https://from-uri.test',
      apiKey: 'dt_pasted',
      publicUrl: null,
      machineName: 'Studio Mac',
      deviceId: 'device-2',
      deviceToken: 'dt_pasted',
      capabilities: ['history:read'],
      serverPublicKey: SPK,
      e2eeRequired: true,
    })

    const onSuccess = jest.fn()
    const { result } = await renderHook(() => useTBPair())

    await act(() => {
      result.current.pair({
        url: '',
        token: `threadbase://pair?url=https%3A%2F%2Ffrom-uri.test&token=pt_uri_tok&spk=${SPK}&v=1`,
        onSuccess,
      })
    })
    await act(async () => {
      await Promise.resolve()
    })

    // The value, not just the call: a paste that pairs in plaintext looks like
    // success from here, which is why this asserts the property explicitly.
    expect(exchangeToken).toHaveBeenCalledWith({
      url: 'https://from-uri.test',
      token: 'pt_uri_tok',
      deviceName: 'Test Phone',
      readOnly: false,
      serverPublicKey: SPK,
    })

    await act(() => {
      jest.advanceTimersByTime(2400)
    })

    // And the far end: the pin and the proved key have to survive the hook's
    // own mapping, or the server record is added unpinned.
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ serverPublicKey: SPK, requireEncryption: true }),
    )
  })

  it('fails a pasted URI whose server key is malformed, without exchanging', async () => {
    const onSuccess = jest.fn()
    const { result } = await renderHook(() => useTBPair())

    await act(() => {
      result.current.pair({
        url: '',
        token: `threadbase://pair?url=https%3A%2F%2Ffrom-uri.test&token=pt_uri_tok&spk=${'C'.repeat(42)}`,
        onSuccess,
      })
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(exchangeToken).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(result.current.phase).toBe('err')
  })
})

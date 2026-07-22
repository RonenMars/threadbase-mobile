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
      publicUrl: 'https://example.test',
      machineName: null,
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
    })
    expect(global.fetch).not.toHaveBeenCalled()

    await act(() => {
      jest.advanceTimersByTime(2400)
    })

    expect(onSuccess).toHaveBeenCalledWith({
      url: 'https://example.test',
      apiKey: 'tb_sealed_key',
    })
    expect(result.current.phase).toBe('ok')
  })

  it('parses a threadbase:// URI and exchanges its embedded token', async () => {
    exchangeToken.mockResolvedValue({
      url: 'https://from-uri.test',
      apiKey: 'tb_from_uri',
      publicUrl: 'https://from-uri.test',
      machineName: null,
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
    })

    await act(() => {
      jest.advanceTimersByTime(2400)
    })

    expect(onSuccess).toHaveBeenCalledWith({
      url: 'https://from-uri.test',
      apiKey: 'tb_from_uri',
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
})

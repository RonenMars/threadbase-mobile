/**
 * A `429` from `/api/e2ee/open` is waited out, not retried into.
 *
 * Device log 2026-10-27 22:12-22:17: the streamer's event loop was blocked for
 * about four minutes, the app kept opening, the timed-out opens were still
 * counted, and the five-per-minute budget was spent by the time the server was
 * healthy again. The app then drew ~15 `429`s in 40 s.
 */
import { createOpenInitiator } from '@/services/e2ee/pair-handshake'
import {
  OpenError,
  openContext,
  openOnFirstReachable,
  _resetOpenRefusalsForTests,
} from '@/services/e2ee/context'

jest.mock('@/services/e2ee/pair-handshake', () => {
  const actual = jest.requireActual(
    '@/services/e2ee/pair-handshake',
  ) as typeof import('@/services/e2ee/pair-handshake')
  return { ...actual, createOpenInitiator: jest.fn() }
})

const mockedOpen = createOpenInitiator as jest.MockedFunction<typeof createOpenInitiator>
const PIN = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const ADDRESSES = ['https://lan.example:7077', 'https://public.example']
const base = { serverId: 'srv', serverPublicKey: PIN, kind: 'rest' as const }

const tooMany = (retryAfter?: string) =>
  ({
    ok: false,
    status: 429,
    headers: { get: (name: string) => (name === 'Retry-After' ? (retryAfter ?? null) : null) },
    json: async () => ({ error: 'Too many handshake attempts; try again in a minute' }),
  }) as unknown as Response

const open = (fetchImpl: jest.Mock) =>
  openOnFirstReachable({ ...base, fetchImpl: fetchImpl as unknown as typeof fetch }, ADDRESSES, openContext)

const outcome = (p: Promise<unknown>) =>
  p.then(
    () => undefined,
    (e: OpenError) => e,
  )

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-10-27T22:00:00Z'))
  _resetOpenRefusalsForTests()
  mockedOpen.mockResolvedValue({
    ok: true,
    handshake: { writeMessage1: async () => new Uint8Array(48) },
  } as unknown as Awaited<ReturnType<typeof createOpenInitiator>>)
})

afterEach(() => {
  _resetOpenRefusalsForTests()
  jest.useRealTimers()
})

describe('429 with Retry-After', () => {
  it('sends no /open for 30 s, then exactly one', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(tooMany('30'))
    const first = await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(first?.message).toContain('Reconnecting in 30 s')
    expect(first?.message).toContain('HTTP 429, Retry-After: 30')

    jest.advanceTimersByTime(29_000)
    const waiting = await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(waiting?.retryable).toBe(true)
    expect(waiting?.retryAfterMs).toBe(1000)
    expect(waiting?.message).toContain('Reconnecting in 1 s')

    jest.advanceTimersByTime(1000)
    await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('waits 60 s when the header is missing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(tooMany())
    await outcome(open(fetchImpl))
    jest.advanceTimersByTime(59_000)
    await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(1000)
    await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('clamps an oversized Retry-After', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(tooMany('86400'))
    const first = await outcome(open(fetchImpl))
    expect(first?.retryAfterMs).toBe(120_000)
    jest.advanceTimersByTime(120_000)
    await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not apply a wait to a different pin', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(tooMany('30'))
    await outcome(open(fetchImpl))
    await outcome(
      openOnFirstReachable(
        { ...base, serverPublicKey: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', fetchImpl: fetchImpl as unknown as typeof fetch },
        ADDRESSES,
        openContext,
      ),
    )
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not hop to the other address after a 429', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(tooMany('30'))
    await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('a waiter behind the single-flight', () => {
  it('is refused locally while the wait is pending', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(tooMany('30'))
    await outcome(open(fetchImpl))
    const waiter = await outcome(openContext({ ...base, baseUrl: ADDRESSES[0], fetchImpl: fetchImpl as unknown as typeof fetch }))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(waiter?.retryAfterMs).toBe(30_000)
  })
})

describe('timeouts', () => {
  const timeout = () => jest.fn().mockRejectedValue(new Error('aborted'))

  it('back off 2 s, 4 s, 8 s and spend one attempt per step', async () => {
    const fetchImpl = timeout()
    let calls = 0
    for (const waitMs of [2000, 4000, 8000]) {
      await outcome(open(fetchImpl))
      calls += ADDRESSES.length
      expect(fetchImpl).toHaveBeenCalledTimes(calls)

      jest.advanceTimersByTime(waitMs - 1)
      await outcome(open(fetchImpl))
      await outcome(open(fetchImpl))
      expect(fetchImpl).toHaveBeenCalledTimes(calls)

      jest.advanceTimersByTime(1)
    }
  })

  it('caps the wait at 30 s', async () => {
    const fetchImpl = timeout()
    for (let i = 0; i < 8; i++) {
      await outcome(open(fetchImpl))
      jest.advanceTimersByTime(30_000)
    }
    const before = fetchImpl.mock.calls.length
    await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(before + ADDRESSES.length)
    jest.advanceTimersByTime(29_999)
    await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(before + ADDRESSES.length)
    jest.advanceTimersByTime(1)
    await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(before + 2 * ADDRESSES.length)
  })

  it('forgets the streak once the server answers', async () => {
    const fetchImpl = timeout()
    await outcome(open(fetchImpl))
    jest.advanceTimersByTime(2000)
    await outcome(open(fetchImpl))
    jest.advanceTimersByTime(4000)
    await outcome(open(jest.fn().mockResolvedValue(tooMany('1'))))
    jest.advanceTimersByTime(1000)
    await outcome(open(fetchImpl))
    jest.advanceTimersByTime(2000)
    const before = fetchImpl.mock.calls.length
    await outcome(open(fetchImpl))
    expect(fetchImpl).toHaveBeenCalledTimes(before + ADDRESSES.length)
  })
})

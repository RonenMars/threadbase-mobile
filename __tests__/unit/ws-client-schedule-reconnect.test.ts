import { wsClient } from '@/services/ws-client'

type Scheduler = { _scheduleReconnect: (waitMs?: number) => void; reconnectAttempt: number; _doConnect: () => Promise<void> }

const WSClientClass = wsClient.constructor as new (serverId?: string) => Scheduler

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('WSClient._scheduleReconnect', () => {
  it('spends one backoff attempt per ladder redial', () => {
    const c = new WSClientClass('t')
    jest.spyOn(c, '_doConnect').mockResolvedValue(undefined)
    c._scheduleReconnect()
    c._scheduleReconnect()
    expect(c.reconnectAttempt).toBe(2)
  })

  it('waits exactly waitMs and spends none of the ladder', () => {
    const c = new WSClientClass('t')
    const dial = jest.spyOn(c, '_doConnect').mockResolvedValue(undefined)
    c._scheduleReconnect(30_000)
    expect(c.reconnectAttempt).toBe(0)
    jest.advanceTimersByTime(29_999)
    expect(dial).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(dial).toHaveBeenCalledTimes(1)
  })
})

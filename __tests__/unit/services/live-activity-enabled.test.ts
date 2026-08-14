import { clientLog } from '@/lib/clientLog'
import { getFeatureFlags } from '@/services/api-client'
import {
  isLiveActivityEnabled,
  resetLiveActivityEnabled,
} from '@/services/live-activity-enabled'

jest.mock('@/services/api-client', () => ({
  getFeatureFlags: jest.fn(),
}))

jest.mock('@/lib/clientLog', () => ({
  clientLog: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const mockGetFeatureFlags = getFeatureFlags as jest.MockedFunction<typeof getFeatureFlags>
const logInfo = jest.mocked(clientLog.info)

/** Lets the lookup's promise chain settle without a fake timer. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

function flags(values: Record<string, boolean>) {
  return { registry: [], values }
}

beforeEach(() => {
  resetLiveActivityEnabled()
  mockGetFeatureFlags.mockReset()
  logInfo.mockClear()
})

describe('isLiveActivityEnabled', () => {
  it('answers false before the server has replied, then true once it says so', async () => {
    mockGetFeatureFlags.mockResolvedValue(flags({ liveActivityPush: true }))

    // The first frame cannot block on the network, so it must draw nothing.
    expect(isLiveActivityEnabled('srv-1')).toBe(false)
    await flush()
    expect(isLiveActivityEnabled('srv-1')).toBe(true)
  })

  it('stays false when the server has the flag off', async () => {
    mockGetFeatureFlags.mockResolvedValue(flags({ liveActivityPush: false }))
    isLiveActivityEnabled('srv-1')
    await flush()
    expect(isLiveActivityEnabled('srv-1')).toBe(false)
  })

  it('treats a server that predates feature flags as off, and says so', async () => {
    // getFeatureFlags maps a 404 to null.
    mockGetFeatureFlags.mockResolvedValue(null)
    isLiveActivityEnabled('srv-old')
    await flush()
    expect(isLiveActivityEnabled('srv-old')).toBe(false)
    // The silent-regression guard: this is the only way surfaces stop appearing
    // without anyone choosing it, so it must be greppable.
    expect(logInfo).toHaveBeenCalledWith('liveActivity.legacyServer', expect.any(String), {
      serverId: 'srv-old',
    })
  })

  it('stays quiet when the server answers explicitly', async () => {
    mockGetFeatureFlags.mockResolvedValue(flags({ liveActivityPush: false }))
    isLiveActivityEnabled('srv-1')
    await flush()
    // An explicit false is somebody's decision, not a surprise worth logging.
    expect(logInfo).not.toHaveBeenCalled()
  })

  it('collapses a burst of frames into one request per server', async () => {
    mockGetFeatureFlags.mockResolvedValue(flags({ liveActivityPush: true }))
    for (let i = 0; i < 20; i++) isLiveActivityEnabled('srv-1')
    await flush()
    expect(mockGetFeatureFlags).toHaveBeenCalledTimes(1)
  })

  it('resolves each server independently', async () => {
    mockGetFeatureFlags.mockImplementation(async (serverId: string) =>
      flags({ liveActivityPush: serverId === 'srv-on' }),
    )
    isLiveActivityEnabled('srv-on')
    isLiveActivityEnabled('srv-off')
    await flush()
    expect(isLiveActivityEnabled('srv-on')).toBe(true)
    expect(isLiveActivityEnabled('srv-off')).toBe(false)
  })

  // The failure case that matters: caching a rejection would pin the feature
  // off until the app restarts, so one dropped request must not be permanent.
  it('retries after a transient failure instead of latching off', async () => {
    mockGetFeatureFlags.mockRejectedValueOnce(new Error('offline'))
    isLiveActivityEnabled('srv-1')
    await flush()

    // Armed before the next call, because that call is itself what retries —
    // isLiveActivityEnabled is the only thing that ever triggers a lookup.
    mockGetFeatureFlags.mockResolvedValue(flags({ liveActivityPush: true }))
    expect(isLiveActivityEnabled('srv-1')).toBe(false)
    await flush()
    expect(isLiveActivityEnabled('srv-1')).toBe(true)
    expect(mockGetFeatureFlags).toHaveBeenCalledTimes(2)
  })
})

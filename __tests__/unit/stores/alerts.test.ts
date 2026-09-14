import { arbitrate, globalSurface } from '@/lib/alertArbitration'
import { useAlertStore, type AlertInput } from '@/stores/alerts'
import { TOAST_DEFAULT_TIMEOUT_MS, serverCause, type AlertCause, type AlertLevel } from '@/types/alerts'

function entry(overrides: {
  id: string
  level: AlertLevel
  title: string
  cause?: AlertCause
  viewport?: string
  message?: string
  timeout?: number | null
  onPress?: () => void
}): AlertInput {
  return {
    id: overrides.id,
    viewport: overrides.viewport ?? 'home',
    cause: overrides.cause ?? serverCause('a'),
    level: overrides.level,
    title: overrides.title,
    message: overrides.message ?? 'body',
    timeout: overrides.timeout,
    onPress: overrides.onPress,
  }
}

beforeEach(() => {
  jest.useFakeTimers()
  useAlertStore.getState().reset()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useAlertStore', () => {
  it('auto-dismisses info after the default timeout', () => {
    useAlertStore.getState().upsert({
      id: 'ephemeral',
      viewport: 'root',
      cause: 'servers:summary',
      level: 'info',
      title: 'Hello',
      message: 'World',
    })
    expect(useAlertStore.getState().alerts).toHaveLength(1)
    jest.advanceTimersByTime(TOAST_DEFAULT_TIMEOUT_MS)
    expect(useAlertStore.getState().alerts).toHaveLength(0)
  })

  it('does not auto-dismiss when timeout is null', () => {
    useAlertStore.getState().upsert({
      id: 'sticky',
      viewport: 'home',
      cause: 'servers:summary',
      level: 'warning',
      title: 'Stay',
      message: 'Please',
      timeout: null,
    })
    jest.advanceTimersByTime(TOAST_DEFAULT_TIMEOUT_MS * 4)
    expect(useAlertStore.getState().alerts).toHaveLength(1)
  })

  it('does not auto-dismiss a warning that omits timeout', () => {
    useAlertStore.getState().upsert(entry({
      id: 'warn',
      level: 'warning',
      title: 'Degraded',
    }))
    jest.advanceTimersByTime(TOAST_DEFAULT_TIMEOUT_MS * 4)
    expect(useAlertStore.getState().alerts).toHaveLength(1)
  })

  it('does not auto-dismiss an error even when timeout is set', () => {
    useAlertStore.getState().upsert(entry({
      id: 'err',
      level: 'error',
      title: 'Failed',
      timeout: 1000,
    }))
    jest.advanceTimersByTime(2000)
    expect(useAlertStore.getState().alerts).toHaveLength(1)
  })

  it('does not revive a sticky-dismissed toast until the fingerprint changes', () => {
    const spec = {
      id: 'server-state',
      viewport: 'home',
      cause: 'servers:summary' as AlertCause,
      level: 'warning' as const,
      title: 'AK is unreachable',
      message: 'Some sessions may be missing.',
      timeout: null,
    }
    useAlertStore.getState().upsert(spec)
    useAlertStore.getState().stickyDismiss('server-state')
    expect(useAlertStore.getState().alerts).toHaveLength(0)
    useAlertStore.getState().upsert(spec)
    expect(useAlertStore.getState().alerts).toHaveLength(0)
    useAlertStore.getState().upsert({ ...spec, title: 'AK is back' })
    expect(useAlertStore.getState().alerts).toHaveLength(1)
  })

  // A replace is a new alert, so it gets a fresh deadline rather than inheriting
  // the remains of the one the first copy was inserted with.
  it('re-arms the timeout when the copy is replaced', () => {
    const base = {
      id: 'ephemeral',
      viewport: 'root',
      cause: 'servers:summary' as AlertCause,
      level: 'info' as const,
      message: 'World',
      timeout: 1000,
    }
    useAlertStore.getState().upsert({ ...base, title: 'First' })
    jest.advanceTimersByTime(800)
    useAlertStore.getState().upsert({ ...base, title: 'Second' })

    // 1200ms since the first insert — the original deadline has passed.
    jest.advanceTimersByTime(400)
    expect(useAlertStore.getState().alerts).toHaveLength(1)

    // 1100ms since the replace.
    jest.advanceTimersByTime(700)
    expect(useAlertStore.getState().alerts).toHaveLength(0)
  })

  // `onPress` is not just a callback: its presence decides whether Toast renders
  // the body as a button at all, so gaining one has to force a repaint even
  // though every word of the copy is unchanged.
  it('replaces rather than mutates when onPress appears under identical copy', () => {
    const base = {
      id: 'server-state',
      viewport: 'home',
      cause: 'servers:summary' as AlertCause,
      level: 'info' as const,
      title: 'Connecting to My Server…',
      message: 'Establishing a connection to the server.',
      timeout: null,
    }
    useAlertStore.getState().upsert(base)
    const before = useAlertStore.getState().alerts

    useAlertStore.getState().upsert({ ...base, onPress: jest.fn() })

    expect(useAlertStore.getState().alerts).not.toBe(before)
    expect(useAlertStore.getState().alerts[0].onPress).toBeDefined()
  })

  it('clears the sticky block when the alert itself goes away', () => {
    const spec = {
      id: 'host-pressure',
      viewport: 'home',
      cause: 'host-pressure:srv' as AlertCause,
      level: 'warning' as const,
      title: 'My Server is under memory pressure.',
      message: 'The computer is busy.',
      timeout: null,
    }
    useAlertStore.getState().upsert(spec)
    useAlertStore.getState().stickyDismiss('host-pressure')
    useAlertStore.getState().dismiss('host-pressure')
    useAlertStore.getState().upsert(spec)
    expect(useAlertStore.getState().alerts).toHaveLength(1)
  })

  it('stamps raisedAt on first insert and keeps it across copy changes', () => {
    jest.setSystemTime(1_000)
    useAlertStore.getState().upsert(entry({
      id: 'one',
      level: 'error',
      title: 'First',
    }))
    expect(useAlertStore.getState().alerts[0].raisedAt).toBe(1_000)

    jest.setSystemTime(5_000)
    useAlertStore.getState().upsert(entry({
      id: 'one',
      level: 'error',
      title: 'Second',
    }))
    expect(useAlertStore.getState().alerts[0].raisedAt).toBe(1_000)
    expect(useAlertStore.getState().alerts[0].title).toBe('Second')
  })
})

describe('arbitrate', () => {
  it('keeps two causes at different severities in their buckets', () => {
    useAlertStore.getState().upsert(entry({
      id: 'err',
      cause: serverCause('one'),
      level: 'error',
      title: 'Down',
    }))
    useAlertStore.getState().upsert(entry({
      id: 'warn',
      cause: serverCause('two'),
      level: 'warning',
      title: 'Slow',
    }))
    const arb = arbitrate(useAlertStore.getState().alerts)
    expect(arb.errors).toHaveLength(1)
    expect(arb.warnings).toHaveLength(1)
    expect(globalSurface(arb)).toBe('error')
  })

  it('keeps the latest copy when the same id is raised twice', () => {
    useAlertStore.getState().upsert(entry({
      id: 'one',
      cause: serverCause('one'),
      level: 'error',
      title: 'First',
    }))
    useAlertStore.getState().upsert(entry({
      id: 'one',
      cause: serverCause('one'),
      level: 'error',
      title: 'Second',
    }))
    const arb = arbitrate(useAlertStore.getState().alerts)
    expect(arb.errors).toHaveLength(1)
    expect(arb.errors[0].title).toBe('Second')
  })

  it('keeps the higher severity when the same cause is raised at two levels', () => {
    useAlertStore.getState().upsert(entry({
      id: 'warn',
      cause: serverCause('one'),
      level: 'warning',
      title: 'Degraded',
    }))
    useAlertStore.getState().upsert(entry({
      id: 'err',
      cause: serverCause('one'),
      level: 'error',
      title: 'Down',
    }))
    const arb = arbitrate(useAlertStore.getState().alerts)
    expect(arb.errors).toHaveLength(1)
    expect(arb.warnings).toHaveLength(0)
    expect(arb.errors[0].id).toBe('err')
    expect(globalSurface(arb)).toBe('error')
  })

  it('lets a critical suppress the global error surface while the error stays listed', () => {
    useAlertStore.getState().upsert(entry({
      id: 'err',
      cause: serverCause('one'),
      level: 'error',
      title: 'Down',
    }))
    useAlertStore.getState().upsert(entry({
      id: 'crit',
      cause: 'query:session',
      level: 'critical',
      title: 'Leave?',
    }))
    const arb = arbitrate(useAlertStore.getState().alerts)
    expect(arb.critical?.id).toBe('crit')
    expect(arb.errors).toHaveLength(1)
    expect(globalSurface(arb)).toBe('critical')
  })

  it('splits claimed errors out of the global surface', () => {
    useAlertStore.getState().upsert(entry({
      id: 'inline',
      cause: serverCause('one'),
      level: 'error',
      title: 'This list',
    }))
    useAlertStore.getState().upsert(entry({
      id: 'elsewhere',
      cause: serverCause('two'),
      level: 'error',
      title: 'Other list',
    }))
    useAlertStore.getState().claimInline(serverCause('one'))
    const { alerts, inlineClaims } = useAlertStore.getState()
    const arb = arbitrate(alerts, inlineClaims)
    expect(arb.inline.map((a) => a.id)).toEqual(['inline'])
    expect(arb.global.map((a) => a.id)).toEqual(['elsewhere'])
    expect(globalSurface(arb)).toBe('error')

    useAlertStore.getState().claimInline(serverCause('two'))
    const after = arbitrate(
      useAlertStore.getState().alerts,
      useAlertStore.getState().inlineClaims,
    )
    expect(after.global).toHaveLength(0)
    expect(globalSurface(after)).toBeNull()
  })
})

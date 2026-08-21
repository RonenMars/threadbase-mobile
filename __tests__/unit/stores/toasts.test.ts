import { useToastStore } from '@/stores/toasts'
import { TOAST_DEFAULT_TIMEOUT_MS } from '@/types/alerts'

beforeEach(() => {
  jest.useFakeTimers()
  useToastStore.getState().reset()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useToastStore', () => {
  it('auto-dismisses after the default timeout', () => {
    useToastStore.getState().upsert({
      id: 'ephemeral',
      viewport: 'root',
      level: 'info',
      title: 'Hello',
      message: 'World',
    })
    expect(useToastStore.getState().toasts).toHaveLength(1)
    jest.advanceTimersByTime(TOAST_DEFAULT_TIMEOUT_MS)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('does not auto-dismiss when timeout is null', () => {
    useToastStore.getState().upsert({
      id: 'sticky',
      viewport: 'home',
      level: 'warning',
      title: 'Stay',
      message: 'Please',
      timeout: null,
    })
    jest.advanceTimersByTime(TOAST_DEFAULT_TIMEOUT_MS * 4)
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('does not revive a sticky-dismissed toast until the fingerprint changes', () => {
    const spec = {
      id: 'server-state',
      viewport: 'home',
      level: 'warning' as const,
      title: 'AK is unreachable',
      message: 'Some sessions may be missing.',
      timeout: null,
    }
    useToastStore.getState().upsert(spec)
    useToastStore.getState().stickyDismiss('server-state')
    expect(useToastStore.getState().toasts).toHaveLength(0)
    useToastStore.getState().upsert(spec)
    expect(useToastStore.getState().toasts).toHaveLength(0)
    useToastStore.getState().upsert({ ...spec, title: 'AK is back' })
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  // A replace is a new alert, so it gets a fresh deadline rather than inheriting
  // the remains of the one the first copy was inserted with.
  it('re-arms the timeout when the copy is replaced', () => {
    const base = {
      id: 'ephemeral',
      viewport: 'root',
      level: 'info' as const,
      message: 'World',
      timeout: 1000,
    }
    useToastStore.getState().upsert({ ...base, title: 'First' })
    jest.advanceTimersByTime(800)
    useToastStore.getState().upsert({ ...base, title: 'Second' })

    // 1200ms since the first insert — the original deadline has passed.
    jest.advanceTimersByTime(400)
    expect(useToastStore.getState().toasts).toHaveLength(1)

    // 1100ms since the replace.
    jest.advanceTimersByTime(700)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  // `onPress` is not just a callback: its presence decides whether Toast renders
  // the body as a button at all, so gaining one has to force a repaint even
  // though every word of the copy is unchanged.
  it('replaces rather than mutates when onPress appears under identical copy', () => {
    const base = {
      id: 'server-state',
      viewport: 'home',
      level: 'info' as const,
      title: 'Connecting to My Server…',
      message: 'Establishing a connection to the server.',
      timeout: null,
    }
    useToastStore.getState().upsert(base)
    const before = useToastStore.getState().toasts

    useToastStore.getState().upsert({ ...base, onPress: jest.fn() })

    expect(useToastStore.getState().toasts).not.toBe(before)
    expect(useToastStore.getState().toasts[0].onPress).toBeDefined()
  })

  it('clears the sticky block when the alert itself goes away', () => {
    const spec = {
      id: 'host-pressure',
      viewport: 'home',
      level: 'warning' as const,
      title: 'My Server is under memory pressure.',
      message: 'The computer is busy.',
      timeout: null,
    }
    useToastStore.getState().upsert(spec)
    useToastStore.getState().stickyDismiss('host-pressure')
    useToastStore.getState().dismiss('host-pressure')
    useToastStore.getState().upsert(spec)
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })
})

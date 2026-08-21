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

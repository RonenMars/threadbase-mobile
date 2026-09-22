import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { useEndSession } from '@/hooks/useEndSession'
import { SessionNotFoundError, type StopWhenIdleResult } from '@/services/api-client'
import { useSessionEndStore } from '@/stores/sessionEnd'

const mockStopMutate = jest.fn()
const mockWhenIdle = jest.fn<Promise<StopWhenIdleResult>, [{ ignoreWatchers?: boolean }?]>()
jest.mock('@/hooks/useSessionActions', () => ({
  useSessionActions: () => ({
    stopSession: { mutate: mockStopMutate, isPending: false },
    stopWhenIdle: { mutateAsync: mockWhenIdle, isPending: false },
  }),
}))

const mockAcquired = jest.fn(() => false)
jest.mock('@/services/ws-client', () => ({
  wsManager: { isSessionAcquired: () => mockAcquired() },
}))

let mockVersion: string | undefined = '1.96.0'
jest.mock('@/stores/servers', () => ({
  useServersStore: <T,>(sel: (s: { servers: Record<string, { serverInfo: { version?: string } }> }) => T) =>
    sel({ servers: { srv: { serverInfo: { version: mockVersion } } } }),
}))

const KEY = 'srv:sess'

async function setup(live = true) {
  const { result } = await renderHook(() => useEndSession('srv', 'sess', live))
  return result
}

beforeEach(() => {
  mockStopMutate.mockReset()
  mockWhenIdle.mockReset()
  mockAcquired.mockReturnValue(false)
  mockVersion = '1.96.0'
  useSessionEndStore.setState({ armed: {}, terminatingAt: {} })
  jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

afterEach(() => jest.restoreAllMocks())

describe('useEndSession — Terminate when done', () => {
  it('re-arms with ignoreWatchers after a plain arm, so a later subscribe cannot cancel it', async () => {
    mockWhenIdle.mockResolvedValueOnce({ status: 'armed' }).mockResolvedValueOnce({ status: 'armed' })
    const result = await setup()
    await act(() => result.current.terminateWhenDone())
    expect(mockWhenIdle.mock.calls).toEqual([[{}], [{ ignoreWatchers: true }]])
    expect(result.current.armed).toBe(true)
  })

  it('arms silently when the only watcher is this phone', async () => {
    mockAcquired.mockReturnValue(true)
    mockWhenIdle
      .mockResolvedValueOnce({ status: 'watchers_present', watcherCount: 1 })
      .mockResolvedValueOnce({ status: 'armed' })
    const result = await setup()
    await act(() => result.current.terminateWhenDone())
    expect(result.current.dialog).toBeNull()
    expect(mockWhenIdle).toHaveBeenLastCalledWith({ ignoreWatchers: true })
    expect(result.current.armed).toBe(true)
  })

  it('asks before arming while another device watches, and arms on confirm', async () => {
    mockAcquired.mockReturnValue(true)
    mockWhenIdle.mockResolvedValueOnce({ status: 'watchers_present', watcherCount: 2 })
    const result = await setup()
    await act(() => result.current.terminateWhenDone())
    expect(result.current.dialog).toBe('watchers')
    expect(mockWhenIdle).toHaveBeenCalledTimes(1)

    mockWhenIdle.mockResolvedValueOnce({ status: 'armed' })
    await act(async () => result.current.confirmWatchers())
    expect(result.current.dialog).toBeNull()
    expect(mockWhenIdle).toHaveBeenLastCalledWith({ ignoreWatchers: true })
    expect(result.current.armed).toBe(true)
  })

  it('stops at killed: an idle session ends on the first call', async () => {
    mockWhenIdle.mockResolvedValueOnce({ status: 'killed' })
    const result = await setup()
    await act(() => result.current.terminateWhenDone())
    expect(mockWhenIdle).toHaveBeenCalledTimes(1)
    expect(result.current.armed).toBe(false)
  })

  it('reports an unexpected response instead of guessing', async () => {
    mockWhenIdle.mockRejectedValueOnce(new Error('stop when idle: unexpected response'))
    const result = await setup()
    await act(() => result.current.terminateWhenDone())
    expect(Alert.alert).toHaveBeenCalled()
    expect(result.current.armed).toBe(false)
  })
})

describe('useEndSession — Terminate and Delete', () => {
  it('marks Terminate in flight and clears the mark when it fails', async () => {
    const result = await setup()
    await act(async () => result.current.terminate())
    expect(mockStopMutate).toHaveBeenCalledWith({}, expect.any(Object))
    expect(useSessionEndStore.getState().terminatingAt[KEY]).toEqual(expect.any(Number))

    const { onError } = mockStopMutate.mock.calls[0][1]
    await act(async () => onError(new Error('offline')))
    expect(useSessionEndStore.getState().terminatingAt[KEY]).toBeUndefined()
    expect(Alert.alert).toHaveBeenCalled()
  })

  it('treats a 404 from Terminate as already ended', async () => {
    const result = await setup()
    await act(async () => result.current.terminate())
    await act(async () => mockStopMutate.mock.calls[0][1].onError(new SessionNotFoundError('sess')))
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('Force terminate goes to /kill', async () => {
    const result = await setup()
    await act(async () => result.current.forceTerminate())
    expect(mockStopMutate).toHaveBeenCalledWith({ force: true }, expect.any(Object))
  })

  it('Delete sends only after the confirmation, and reports deleting from the tap', async () => {
    const result = await setup()
    await act(async () => result.current.requestDelete())
    expect(result.current.dialog).toBe('delete')
    expect(mockStopMutate).not.toHaveBeenCalled()

    await act(async () => result.current.confirmDelete())
    expect(mockStopMutate).toHaveBeenCalledWith({ delete: true }, expect.any(Object))
    expect(result.current.deleting).toBe(true)
    expect(result.current.dialog).toBeNull()

    await act(async () => mockStopMutate.mock.calls[0][1].onError(new Error('offline')))
    expect(result.current.deleting).toBe(false)
  })

  it('gates the new actions on server 1.96.0', async () => {
    mockVersion = '1.95.2'
    expect((await setup()).current.supported).toBe(false)
    mockVersion = undefined
    expect((await setup()).current.supported).toBe(false)
  })

  it('drops the marks once the session is no longer live', async () => {
    useSessionEndStore.setState({ armed: { [KEY]: true }, terminatingAt: { [KEY]: 1 } })
    await setup(false)
    expect(useSessionEndStore.getState().armed[KEY]).toBeUndefined()
    expect(useSessionEndStore.getState().terminatingAt[KEY]).toBeUndefined()
  })
})

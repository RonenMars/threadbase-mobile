import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getEtag,
  setEtag,
  deleteEtag,
  hydrateEtags,
  ETAG_STORAGE_KEY,
  __resetEtagStoreForTests,
} from '@/services/etag-store'

const mockGetItem = AsyncStorage.getItem as jest.Mock
const mockSetItem = AsyncStorage.setItem as jest.Mock

beforeEach(() => {
  jest.useFakeTimers()
  mockGetItem.mockReset().mockResolvedValue(null)
  mockSetItem.mockReset().mockResolvedValue(undefined)
  __resetEtagStoreForTests()
})

afterEach(() => {
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

describe('etag-store', () => {
  it('hydrates the map from AsyncStorage on init', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ 'srv::c1': '"v9"' }))
    await hydrateEtags()
    expect(mockGetItem).toHaveBeenCalledWith(ETAG_STORAGE_KEY)
    expect(getEtag('srv::c1')).toBe('"v9"')
  })

  it('treats corrupt stored JSON as an empty map (graceful)', async () => {
    mockGetItem.mockResolvedValue('{not json')
    await hydrateEtags()
    expect(getEtag('srv::c1')).toBeUndefined()
  })

  it('debounces a write after set, persisting the serialized map', async () => {
    setEtag('srv::c1', '"v1"')
    setEtag('srv::c2', '"v2"')
    expect(mockSetItem).not.toHaveBeenCalled() // debounced, not yet flushed
    jest.advanceTimersByTime(1000)
    expect(mockSetItem).toHaveBeenCalledTimes(1)
    const [key, payload] = mockSetItem.mock.calls[0]
    expect(key).toBe(ETAG_STORAGE_KEY)
    expect(JSON.parse(payload)).toEqual({ 'srv::c1': '"v1"', 'srv::c2': '"v2"' })
  })

  it('debounces a write after delete', async () => {
    setEtag('srv::c1', '"v1"')
    jest.advanceTimersByTime(1000)
    mockSetItem.mockClear()
    deleteEtag('srv::c1')
    jest.advanceTimersByTime(1000)
    expect(mockSetItem).toHaveBeenCalledTimes(1)
    expect(JSON.parse(mockSetItem.mock.calls[0][1])).toEqual({})
  })
})

import { renderHook, act } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useHubTour, HUB_TOUR_KEY } from '@/components/tour/useHubTour'

beforeEach(() => {
  jest.clearAllMocks()
  ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(null)
  ;(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined)
})

describe('useHubTour', () => {
  it('starts at step 0 when tour has not been seen', async () => {
    const { result } = renderHook(() => useHubTour())
    await act(async () => {})
    expect(result.current?.stepIndex).toBe(0)
  })

  it('returns null when tour has already been seen', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue('seen')
    const { result } = renderHook(() => useHubTour())
    await act(async () => {})
    expect(result.current).toBeNull()
  })

  it('advances to step 1 when advanceStep is called', async () => {
    const { result } = renderHook(() => useHubTour())
    await act(async () => {})
    act(() => { result.current?.advanceStep() })
    expect(result.current?.stepIndex).toBe(1)
  })

  it('returns null after all 3 steps are advanced past', async () => {
    const { result } = renderHook(() => useHubTour())
    await act(async () => {})
    act(() => { result.current?.advanceStep() })
    act(() => { result.current?.advanceStep() })
    act(() => { result.current?.advanceStep() })
    expect(result.current).toBeNull()
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(HUB_TOUR_KEY, 'seen')
  })

  it('returns null and marks seen when skipTour is called', async () => {
    const { result } = renderHook(() => useHubTour())
    await act(async () => {})
    act(() => { result.current?.skipTour() })
    expect(result.current).toBeNull()
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(HUB_TOUR_KEY, 'seen')
  })
})

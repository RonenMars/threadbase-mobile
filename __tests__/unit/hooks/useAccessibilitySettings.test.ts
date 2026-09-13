import { AccessibilityInfo } from 'react-native'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'

// React Native's jest setup already stubs AccessibilityInfo with jest.fn()s.
const addListener = AccessibilityInfo.addEventListener as jest.Mock

describe('useReduceMotion', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    addListener.mockClear()
  })

  it('reads the setting once and follows later changes', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)

    const { result } = await renderHook(() => useReduceMotion())
    await waitFor(() => expect(result.current).toBe(true))

    const call = addListener.mock.calls.find(([event]) => event === 'reduceMotionChanged')
    expect(call).toBeTruthy()
    await act(async () => call?.[1](false))
    await waitFor(() => expect(result.current).toBe(false))
  })
})

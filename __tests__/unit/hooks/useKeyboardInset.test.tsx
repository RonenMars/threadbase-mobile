import { useKeyboardInset } from '@/hooks/useKeyboardInset'

// Negative, matching the library: `height` is a translateY value.
const mockKeyboard = { height: { value: 0 } }
jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => mockKeyboard,
}))

// Both hooks useKeyboardInset calls are mocked to plain functions (reanimated's
// useAnimatedStyle invokes the worklet immediately), so no renderer is needed.
function readInset(): { paddingBottom: number } {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- see above
  return useKeyboardInset() as unknown as { paddingBottom: number }
}

describe('useKeyboardInset', () => {
  it('lifts the surface by the keyboard height', () => {
    mockKeyboard.height.value = -336
    expect(readInset().paddingBottom).toBe(336)
  })

  it('adds nothing while the keyboard is closed', () => {
    mockKeyboard.height.value = 0
    expect(readInset().paddingBottom).toBeCloseTo(0)
  })
})

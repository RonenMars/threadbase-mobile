import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import { useAnimatedStyle } from 'react-native-reanimated'

/**
 * Bottom inset that keeps a full-bleed surface's footer (the composer) above the
 * software keyboard.
 *
 * Used instead of `KeyboardAvoidingView`: KAV derives the lift from its own
 * measured frame — `onLayout` plus an async native `viewPositionInWindow`
 * round-trip under `automaticOffset` — scaled by a per-instance mirror of the
 * keyboard progress. Either can go stale: a re-layout while a conversation page
 * lands, or a mount under an already-open keyboard, leaves the composer at an
 * offset that no longer matches the keyboard (behind it, or still lifted after
 * it is gone) until the next keyboard event resizes it.
 *
 * Both callers span to the screen's bottom edge, so the lift is exactly the
 * keyboard height read from the app-wide KeyboardProvider — no measurement, no
 * per-instance state to fall out of sync. Android needs the same padding as
 * iOS: `edgeToEdgeEnabled` (android/gradle.properties) means the keyboard does
 * not resize the window, so nothing else lifts the composer there either.
 */
export function useKeyboardInset() {
  const { height } = useReanimatedKeyboardAnimation()
  return useAnimatedStyle(() => ({ paddingBottom: -height.value }))
}

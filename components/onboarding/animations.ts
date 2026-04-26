import {
  Easing,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

// ob-glow — pulsing radial glow on icons + green dot.
export function obGlow() {
  'worklet'
  return withRepeat(
    withSequence(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.55, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
    ),
    -1,
    false,
  )
}

// ob-thread-pulse — drives strokeDashoffset on background SVG threads + arcs.
export function obThreadPulse(delayMs = 0) {
  'worklet'
  return withDelay(
    delayMs,
    withRepeat(
      withSequence(
        withTiming(120, { duration: 2000, easing: Easing.linear }),
        withTiming(0, { duration: 2000, easing: Easing.linear }),
      ),
      -1,
      false,
    ),
  )
}

// ob-pop — Done step checkmark scale-in.
export function obPop() {
  'worklet'
  return withSequence(
    withTiming(1.08, { duration: 220, easing: Easing.out(Easing.cubic) }),
    withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) }),
  )
}

// ob-cursor — terminal cursor block blink.
export function obCursor() {
  'worklet'
  return withRepeat(
    withSequence(
      withTiming(1, { duration: 0 }),
      withTiming(0, { duration: 500 }),
      withTiming(1, { duration: 500 }),
    ),
    -1,
    false,
  )
}

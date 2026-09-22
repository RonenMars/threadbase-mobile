import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'

const FLAGS = {
  reduceMotion: {
    query: () => AccessibilityInfo.isReduceMotionEnabled(),
    event: 'reduceMotionChanged',
  },
  reduceTransparency: {
    query: () => AccessibilityInfo.isReduceTransparencyEnabled(),
    event: 'reduceTransparencyChanged',
  },
  screenReader: {
    query: () => AccessibilityInfo.isScreenReaderEnabled(),
    event: 'screenReaderChanged',
  },
} as const

function useAccessibilityFlag(flag: keyof typeof FLAGS, enabled: boolean): boolean {
  const [value, setValue] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let mounted = true
    void FLAGS[flag].query().then((v) => {
      if (mounted) setValue(v)
    })
    const subscription = AccessibilityInfo.addEventListener(FLAGS[flag].event, setValue)
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [flag, enabled])

  return value
}

/** Reduce Motion: loops stop and slides go instant. State stays on colour and text, never on motion. */
export function useReduceMotion(): boolean {
  return useAccessibilityFlag('reduceMotion', true)
}

/** Reduce Transparency is an iOS setting; elsewhere glass never applies, so this stays false. */
export function useReduceTransparency(): boolean {
  return useAccessibilityFlag('reduceTransparency', Platform.OS === 'ios')
}

/** VoiceOver or TalkBack. Timed content waits for the user instead of expiring under it. */
export function useScreenReaderEnabled(): boolean {
  return useAccessibilityFlag('screenReader', true)
}

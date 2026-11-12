import { Stack } from 'expo-router'
import { useAppDirection } from '@/lib/rtl'

// Session screens draw their own headers (ScreenHeader / the start screen's
// own chrome), so the whole group runs headerless. `new` replaces itself with
// `[id]` inside this stack once the start POST resolves; with a single route
// left, back() bubbles to the parent stack and lands on the hub.
export default function SessionLayout() {
  const { isRTL } = useAppDirection()

  // activityEnabled: a pushed-under session screen stays mounted in the native
  // stack, so without this its WS handlers keep firing on every frame and its
  // VirtualTerminal keeps growing — the app slows down linearly with the number
  // of sessions opened in one run. React Activity hides a screen once another
  // is above it, running its effect cleanups and pausing its render until it is
  // shown again. expo-router 58 ignores the old freezeOnBlur option.
  return (
    <Stack
      activityEnabled
      screenOptions={{
        headerShown: false,
        animation: isRTL ? 'slide_from_left' : undefined,
      }}
    >
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" />
    </Stack>
  )
}

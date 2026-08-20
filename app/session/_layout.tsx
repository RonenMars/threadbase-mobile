import { Stack } from 'expo-router'
import i18n from '@/lib/i18n'

// Session screens draw their own headers (ScreenHeader / the start screen's
// own chrome), so the whole group runs headerless. `new` replaces itself with
// `[id]` inside this stack once the start POST resolves; with a single route
// left, back() bubbles to the parent stack and lands on the hub.
export default function SessionLayout() {
  // freezeOnBlur: a pushed-under session screen stays mounted in the native
  // stack, so without this its WS handlers keep firing on every frame and its
  // VirtualTerminal keeps growing — the app slows down linearly with the number
  // of sessions opened in one run. Freezing suspends the hidden screen's render
  // and effects until it's focused again.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        animation: i18n.dir() === 'rtl' ? 'slide_from_left' : undefined,
      }}
    >
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" />
    </Stack>
  )
}

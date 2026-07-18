import { Stack } from 'expo-router'

// Session screens draw their own headers (ScreenHeader / the start screen's
// own chrome), so the whole group runs headerless. `new` replaces itself with
// `[id]` inside this stack once the start POST resolves; with a single route
// left, back() bubbles to the parent stack and lands on the hub.
export default function SessionLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" />
    </Stack>
  )
}

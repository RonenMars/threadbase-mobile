/**
 * An endless Animated.loop must not register as an interaction. On web there is no
 * native driver, so react-native-web defaults a timing to `isInteraction: true` and a
 * running loop holds its InteractionManager forever. VirtualizedList's batched window
 * update waits behind it, so after a reload the Projects list stopped at its first
 * `initialNumToRender` rows. React Native core has dropped InteractionManager, so the
 * contract is checked on the config every looped timing is started with.
 */
import React from 'react'
import { Animated } from 'react-native'
import { cleanup } from '@testing-library/react-native'
import { FAB } from '@/components/ui/FAB'
import { SkeletonBox } from '@/components/ui/Skeleton'
import { LiveDot } from '@/components/sessions/LiveDot'
import { KnightRiderScanner } from '@/components/sessions/KnightRiderScanner'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { renderWithI18n } from '@/test-utils/render'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

afterEach(async () => {
  jest.restoreAllMocks()
  await cleanup()
})

it.each([
  ['FAB', <FAB key="fab" onPress={() => {}} />],
  ['SkeletonBox', <SkeletonBox key="skeleton" />],
  ['LiveDot', <LiveDot key="dot" live color="#0f0" />],
  ['KnightRiderScanner', <KnightRiderScanner key="scanner" />],
  ['LoadingOverlay', <LoadingOverlay key="overlay" visible />],
])('%s starts its loop without holding interactions', async (_name, element) => {
  const timing = jest.spyOn(Animated, 'timing')
  await renderWithI18n(element)
  const looped = timing.mock.calls.filter(([, config]) => config.useNativeDriver)
  expect(looped.length).toBeGreaterThan(0)
  for (const [, config] of looped) expect(config.isInteraction).toBe(false)
})

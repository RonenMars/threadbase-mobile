import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { PagerDots } from './components/PagerDots'
import { colors, fonts } from './theme'
import { flexRow } from '@/lib/rtl'

interface Props {
  index: number
  total: number
  direction: 1 | -1 | 0
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  children: React.ReactNode
}

export function OnboardingShell({
  index,
  total,
  direction,
  onNext,
  onBack,
  onSkip,
  children,
}: Props) {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation('onboarding')

  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      'worklet'
      if (Math.abs(e.translationX) <= 50) return
      if (e.translationX < 0) onNext()
      else onBack()
    })
    .runOnJS(true)

  const showBack = index > 0
  const showSkip = index < total - 1
  const Entering = direction === -1 ? SlideInLeft : SlideInRight

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.chrome}>
        {showBack ? (
          <Pressable onPress={onBack} style={styles.chromeBtn} hitSlop={10}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path
                d="M19 12H5M11 6l-6 6 6 6"
                fill="none"
                stroke={colors.fg2}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.chromeBack}>{t('shell.back')}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {showSkip ? (
          <Pressable onPress={onSkip} style={styles.chromeBtn} hitSlop={10}>
            <Text style={styles.chromeSkip}>{t('shell.skip')}</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <GestureDetector gesture={swipe}>
        <Animated.View
          key={index}
          style={styles.content}
          entering={Entering.duration(350)}
        >
          {children}
        </Animated.View>
      </GestureDetector>

      <View style={[styles.dotsWrap, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <PagerDots count={total} index={index} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink1,
  },
  chrome: {
    flexDirection: flexRow(),
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 36,
  },
  chromeBtn: {
    flexDirection: flexRow(),
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chromeBack: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  chromeSkip: {
    color: colors.fg3,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: '500',
  },
  content: { flex: 1 },
  dotsWrap: { paddingHorizontal: 16, paddingTop: 10 },
})

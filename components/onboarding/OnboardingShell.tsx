import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, ArrowRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { PagerDots } from './components/PagerDots'
import { colors, fonts } from './theme'

interface Props {
  index: number
  total: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  /** When false, the Skip chrome control is hidden (Welcome). Default: index < total - 1. */
  showSkip?: boolean
  /** Semantic skip action. Default: skip. */
  skipLabel?: 'skip' | 'pairLater'
  children: React.ReactNode
}

function getSkipLabel(label: 'skip' | 'pairLater', t: TFunction<'onboarding'>): string {
  switch (label) {
    case 'skip':
      return t('shell.skip')
    case 'pairLater':
      return t('shell.pairLater')
  }
}

export function OnboardingShell({
  index,
  total,
  onNext,
  onBack,
  onSkip,
  showSkip: showSkipProp,
  skipLabel = 'skip',
  children,
}: Props) {
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation('onboarding')
  const localeDirection = i18n.dir() === 'rtl' ? 'rtl' : 'ltr'

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
  const showSkip = showSkipProp ?? index < total - 1
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View
        testID="onboarding-shell-chrome"
        style={[styles.chrome, { direction: localeDirection }]}
      >
        {showBack ? (
          <Pressable
            testID="onboarding-shell-back"
            onPress={onBack}
            style={[styles.chromeBtn, { direction: localeDirection }]}
            hitSlop={10}
          >
            {localeDirection === 'rtl' ? (
              <ArrowRight
                testID="onboarding-shell-back-arrow-right"
                size={18}
                weight="bold"
                color={colors.fg2}
              />
            ) : (
              <ArrowLeft
                testID="onboarding-shell-back-arrow-left"
                size={18}
                weight="bold"
                color={colors.fg2}
              />
            )}
            <Text style={styles.chromeBack}>{t('shell.back')}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {showSkip ? (
          <Pressable
            testID="onboarding-shell-skip"
            onPress={onSkip}
            style={[styles.chromeBtn, { direction: localeDirection }]}
            hitSlop={10}
          >
            <Text style={styles.chromeSkip}>{getSkipLabel(skipLabel, t)}</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <GestureDetector gesture={swipe}>
        <View
          key={index}
          style={styles.content}
        >
          {children}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 36,
  },
  chromeBtn: {
    flexDirection: 'row',
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

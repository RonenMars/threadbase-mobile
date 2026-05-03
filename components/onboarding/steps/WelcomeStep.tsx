import React, { useEffect } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { PrimaryButton } from '../components/PrimaryButton'
import { ThreadField } from '../components/ThreadField'
import { colors, fonts } from '../theme'

interface Props {
  onNext: () => void
}

export function WelcomeStep({ onNext }: Props) {
  const { t } = useTranslation('onboarding')
  const glow = useSharedValue(0.55)

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.55, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [glow])

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  return (
    <View style={styles.root}>
      <ThreadField />

      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.iconGlow, glowStyle]} />
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.icon}
            resizeMode="cover"
          />
        </View>

        <Text style={styles.eyebrow}>{t('welcome.eyebrow')}</Text>

        <Text style={styles.headline}>
          {t('welcome.headline')}{'\n'}
          <Text style={styles.headlineAccent}>{t('welcome.headlineAccent')}</Text>
        </Text>

        <Text style={styles.body}>{t('welcome.body')}</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton onPress={onNext}>{t('welcome.cta')}</PrimaryButton>
      </View>
    </View>
  )
}

const ICON_SIZE = 96

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22, paddingTop: 4 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    top: -30,
    left: -30,
    right: -30,
    bottom: -30,
    borderRadius: (ICON_SIZE + 60) / 2,
    backgroundColor: 'rgba(99,179,255,0.4)',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(99,179,255,0.3)',
    shadowColor: colors.blue400,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
  },
  eyebrow: {
    color: colors.fg3,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  headline: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 36,
    lineHeight: 36,
    fontWeight: '600',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 14,
  },
  headlineAccent: { color: colors.blue400 },
  body: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  footer: { paddingBottom: 14 },
})

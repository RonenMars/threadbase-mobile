import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Defs,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { PrimaryButton } from '../components/PrimaryButton'
import { colors, fonts } from '../theme'

interface Props {
  onEnter: () => void
  serverHost?: string
  serverPort?: string | number
}

export function DoneStep({ onEnter, serverHost, serverPort }: Props) {
  const paired = serverHost != null && serverPort != null
  const popScale = useSharedValue(0.8)
  const popOpacity = useSharedValue(0)
  const dotOpacity = useSharedValue(0.55)

  useEffect(() => {
    popScale.value = withSequence(
      withTiming(1.08, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) }),
    )
    popOpacity.value = withTiming(1, { duration: 250 })
    if (paired) {
      dotOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.55, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      )
    }
  }, [paired, popScale, popOpacity, dotOpacity])

  const popStyle = useAnimatedStyle(() => ({
    opacity: popOpacity.value,
    transform: [{ scale: popScale.value }],
  }))

  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }))

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg
          viewBox="0 0 360 580"
          preserveAspectRatio="xMidYMid slice"
          width="100%"
          height="100%"
          style={{ opacity: 0.35 }}
        >
          <Defs>
            <RadialGradient id="doneGlow" cx="50%" cy="38%" r="50%">
              <Stop offset="0%" stopColor={colors.green400} stopOpacity={0.5} />
              <Stop offset="100%" stopColor={colors.green400} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={360} height={580} fill="url(#doneGlow)" />
        </Svg>
      </View>

      <View style={styles.center}>
        <Animated.View style={[styles.checkWrap, popStyle]}>
          <View style={styles.checkGlow} />
          <View style={styles.check}>
            <Svg width={28} height={28} viewBox="0 0 24 24">
              <Polyline
                points="20 6 9 17 4 12"
                fill="none"
                stroke="#0a1424"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </Animated.View>

        <Text style={[styles.eyebrow, !paired && styles.eyebrowUnpaired]}>
          {paired ? 'HANDSHAKE COMPLETE' : 'ALL SET'}
        </Text>
        <Text style={styles.headline}>
          {paired ? 'Thread is live.' : "You're in."}
        </Text>
        <Text style={styles.body}>
          {paired
            ? 'Your laptop is listening. Open a session whenever the mood strikes.'
            : "Skip it for now — you can connect a runtime from Settings whenever you’re ready."}
        </Text>

        <View style={styles.pill}>
          {paired ? (
            <Animated.View style={[styles.pillDot, dotStyle]} />
          ) : (
            <View style={[styles.pillDot, styles.pillDotIdle]} />
          )}
          <Text style={styles.pillText}>
            {paired
              ? `paired · ${serverHost} · ${serverPort}`
              : 'no runtime paired · pair from Settings'}
          </Text>
        </View>
      </View>

      <PrimaryButton testID="onboarding-done-cta" onPress={onEnter} showIcon={false}>
        {paired ? 'Enter Threadbase' : 'Enter without pairing'}
      </PrimaryButton>
      <View style={{ height: 14 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22, paddingTop: 4 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  checkWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  checkGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(74,222,128,0.35)',
  },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.green400,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.65,
    shadowRadius: 40,
  },
  eyebrow: {
    color: colors.green400,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  eyebrowUnpaired: {
    color: colors.fg3,
  },
  headline: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.8,
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: colors.fg2,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.ink5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.green500,
  },
  pillDotIdle: {
    backgroundColor: colors.fg4,
    opacity: 0.7,
  },
  pillText: {
    color: colors.fg3,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
})

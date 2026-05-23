import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { PrimaryButton } from '../components/PrimaryButton'
import { colors, fonts } from '../theme'

const AnimatedPath = Animated.createAnimatedComponent(Path)

interface Props {
  onNext: () => void
}

function PulsingArc({
  d,
  stroke,
  delay,
}: {
  d: string
  stroke: string
  delay: number
}) {
  const offset = useSharedValue(0)

  useEffect(() => {
    offset.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(120, { duration: 1200, easing: Easing.linear }),
          withTiming(0, { duration: 1200, easing: Easing.linear }),
        ),
        -1,
        false,
      ),
    )
  }, [delay, offset])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }))

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
      strokeDasharray="4 4"
      animatedProps={animatedProps}
    />
  )
}

export function ValuePropStep({ onNext }: Props) {
  const { t } = useTranslation('onboarding')

  return (
    <View style={styles.root}>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Text style={styles.eyebrow}>{'>'} 01 / WHY</Text>

      <Text style={styles.headline}>
        {t('valueProp.headlineMain')}{' '}
        <Text style={styles.headlineMuted}>{t('valueProp.headlineMuted')}</Text>
      </Text>

      <View style={styles.diagram}>
        <View style={styles.diagramRow}>
          {/* Phone glyph */}
          <View style={styles.col}>
            <View style={styles.phone}>
              <View style={styles.phoneSpeaker} />
              <View style={styles.phoneHome} />
            </View>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <Text style={[styles.glyphLabel, { color: colors.blue400 }]}>YOU</Text>
          </View>

          {/* Connector */}
          <View style={styles.connector}>
            <Svg
              viewBox="0 0 200 36"
              preserveAspectRatio="none"
              width="100%"
              height="100%"
              style={StyleSheet.absoluteFill}
            >
              <PulsingArc
                d="M0 18 Q 100 -10 200 18"
                stroke={colors.blue500}
                delay={0}
              />
              <PulsingArc
                d="M200 18 Q 100 46 0 18"
                stroke={colors.amber500}
                delay={1200}
              />
            </Svg>
            <View style={[styles.connectorLabel, styles.connectorLabelTop]}>
              <Text style={[styles.connectorLabelText, { color: colors.blue400 }]}>
                {t('valueProp.labelPrompts')}
              </Text>
            </View>
            <View style={[styles.connectorLabel, styles.connectorLabelBottom]}>
              <Text style={[styles.connectorLabelText, { color: colors.amber400 }]}>
                {t('valueProp.labelStdout')}
              </Text>
            </View>
          </View>

          {/* Laptop glyph */}
          <View style={styles.col}>
            <View style={styles.laptopLid}>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <Text style={styles.laptopText}>claude run</Text>
            </View>
            <View style={styles.laptopBase} />
            <Text
              style={[styles.glyphLabel, { color: colors.amber400, marginTop: 8 }]}
            >
              {/* eslint-disable-next-line i18next/no-literal-string */}
              RUNTIME
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.body}>{t('valueProp.body')}</Text>

      <View style={styles.flex} />

      <PrimaryButton onPress={onNext}>{t('valueProp.cta')}</PrimaryButton>
      <View style={{ height: 14 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22, paddingTop: 4 },
  eyebrow: {
    color: colors.amber400,
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  headline: {
    color: colors.fg0,
    fontFamily: fonts.sans,
    fontSize: 30,
    lineHeight: 33,
    fontWeight: '600',
    letterSpacing: -0.75,
    marginBottom: 18,
  },
  headlineMuted: { color: colors.fg3 },
  diagram: {
    backgroundColor: colors.ink0,
    borderWidth: 1,
    borderColor: colors.ink5,
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 14,
    marginBottom: 18,
    overflow: 'hidden',
  },
  diagramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  col: { alignItems: 'center', flexShrink: 0 },
  phone: {
    width: 46,
    height: 74,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.blue400,
    backgroundColor: colors.ink2,
    marginBottom: 6,
    shadowColor: colors.blue400,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  phoneSpeaker: {
    position: 'absolute',
    top: 5,
    left: 16,
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.ink5,
  },
  phoneHome: {
    position: 'absolute',
    bottom: 6,
    left: 14,
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: colors.blue500,
  },
  laptopLid: {
    width: 78,
    height: 50,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.amber400,
    backgroundColor: colors.ink2,
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.amber400,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  laptopText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.amber400,
    fontWeight: '500',
  },
  laptopBase: {
    height: 3,
    width: 90,
    backgroundColor: colors.amber500,
    opacity: 0.6,
  },
  glyphLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  connector: {
    flex: 1,
    height: 36,
    position: 'relative',
  },
  connectorLabel: {
    position: 'absolute',
    left: '50%',
    backgroundColor: colors.ink0,
    paddingHorizontal: 6,
    transform: [{ translateX: -24 }],
  },
  connectorLabelTop: { top: -6 },
  connectorLabelBottom: { bottom: -6 },
  connectorLabelText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '500',
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.fg2,
  },
  flex: { flex: 1 },
})

import React, { useEffect, useRef } from 'react'
import { Animated, Easing, View, Text } from 'react-native'
import { CircleNotch } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { dark } from '@/constants/theme'

interface Props {
  visible: boolean
  loaded: number
  total: number
  serverLabel: string | null
}

const SPIN_DURATION_MS = 900

export function SessionsLoadingOverlay({ visible, loaded, total, serverLabel }: Props) {
  const { t } = useTranslation('sessions')
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [visible, spin])

  if (!visible) return null

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  // Total is 0 until the first page of the current server returns. Show an
  // indeterminate bar in that brief window to avoid a 0/0 reading.
  const ratio = total > 0 ? Math.min(1, loaded / total) : 0
  const showRatio = total > 0

  return (
    <View
      pointerEvents="auto"
      className="absolute inset-0 items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(13, 17, 23, 0.55)' }}
      accessibilityRole="progressbar"
      accessibilityLabel={t('loading.title')}
    >
      <View
        className="rounded-2xl px-6 py-5 items-center"
        style={{
          backgroundColor: dark.bg.card,
          minWidth: 240,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <CircleNotch size={28} color={dark.text.accent} weight="bold" />
        </Animated.View>

        <Text
          className="mt-3 text-base font-semibold"
          style={{ color: dark.text.primary }}
          numberOfLines={1}
        >
          {showRatio
            ? t('loading.progress', { loaded, total })
            : t('loading.title')}
        </Text>

        <Text
          className="mt-1 text-xs"
          style={{ color: dark.text.secondary }}
          numberOfLines={1}
        >
          {serverLabel
            ? t('loading.fetchingServer', { server: serverLabel })
            : t('loading.fetchingNoLabel')}
        </Text>

        <View
          className="mt-3 h-1.5 w-48 rounded-full overflow-hidden"
          style={{ backgroundColor: dark.border }}
        >
          <View
            style={{
              width: `${ratio * 100}%`,
              height: '100%',
              backgroundColor: dark.text.accent,
              borderRadius: 999,
            }}
          />
        </View>
      </View>
    </View>
  )
}

import { useEffect, useState } from 'react'
import { Animated, Easing, View, StyleSheet, type LayoutChangeEvent } from 'react-native'
import { useTranslation } from 'react-i18next'
import { type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useReduceMotion } from '@/hooks/useAccessibilitySettings'
import { StateBadge, getSessionTierLabel } from '@/components/sessions/StateBadge'
import { getAgentPhaseLabel } from '@/components/sessions/agentPhaseLabel'
import { formatCoarseElapsed } from '@/components/sessions/shared/formatCoarseElapsed'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { useSessionRowActions } from '@/hooks/useSessionRowActions'
import { EndSessionStatus } from '@/components/sessions/EndSessionStatus'
import type { ProviderName } from '@/constants/providers'
import type { MultiSession } from '@/types/api'
import { LiveCard } from './LiveCard'

interface Props {
  session: MultiSession
  title: string
  serverLabel?: string | null
  serverColor?: string | null
  dominantProvider?: ProviderName
  isFirst?: boolean
}

const SWEEP_MS = 1600
const SWEEP_WIDTH = 0.34

/** 2 px indeterminate sweep. There is no percentage anywhere in the API, so never a determinate bar. */
function SweepBar({ color, track }: { color: string; track: string }) {
  const reduceMotion = useReduceMotion()
  const [trackWidth, setTrackWidth] = useState(0)
  const [x] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (!trackWidth || reduceMotion) return
    const barWidth = trackWidth * SWEEP_WIDTH
    x.setValue(-barWidth)
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: trackWidth,
        duration: SWEEP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [trackWidth, reduceMotion, x])

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)

  return (
    <View style={[sweepStyles.track, { backgroundColor: track }]} onLayout={onLayout}>
      <Animated.View
        style={[
          sweepStyles.bar,
          { backgroundColor: color },
          { transform: [{ translateX: x }] },
        ]}
      />
    </View>
  )
}

const sweepStyles = StyleSheet.create({
  track: { height: 2, borderRadius: 1, overflow: 'hidden' },
  bar: { position: 'absolute', top: 0, height: 2, width: `${SWEEP_WIDTH * 100}%`, borderRadius: 1 },
})

export function WorkingCard({ session, title, serverLabel, serverColor, dominantProvider, isFirst }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const { handlePress, handleLongPress, handleMenuPress, overlays, endStatus } = useSessionRowActions(session, title)
  const { subStatus } = deriveSessionPresentation(session)
  const phase = subStatus ? getAgentPhaseLabel(subStatus, t) : null
  const elapsed = formatCoarseElapsed(session.elapsedMs)
  const qualifier = phase ? `${phase} · ${elapsed}` : elapsed
  const tierLabel = getSessionTierLabel('working', t)

  return (
    <LiveCard
      title={title}
      color={theme.status.running}
      emphasis="faint"
      serverLabel={serverLabel}
      serverColor={serverColor}
      provider={session.provider}
      dominantProvider={dominantProvider}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onMenuPress={handleMenuPress}
      accessibilityLabel={`${title}, ${tierLabel}`}
      testID={`session-row-${session.id}`}
      isFirst={isFirst}
    >
      <StateBadge tier="working" qualifier={qualifier} />
      <SweepBar color={theme.status.running} track={trackColor(theme)} />
      <EndSessionStatus {...endStatus} />
      {overlays}
    </LiveCard>
  )
}

function trackColor(theme: Theme): string {
  return theme.bg.primary
}

import { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { StateBadge, getSessionTierLabel } from '@/components/sessions/StateBadge'
import { getAgentPhaseLabel } from '@/components/sessions/agentPhaseLabel'
import { formatCoarseElapsed } from '@/components/sessions/shared/formatCoarseElapsed'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { useSessionRowActions } from '@/hooks/useSessionRowActions'
import type { MultiSession } from '@/types/api'
import { LiveCard } from './LiveCard'

interface Props {
  session: MultiSession
  title: string
  serverLabel?: string | null
  serverColor?: string | null
  isFirst?: boolean
}

const SWEEP_MS = 1600
const SWEEP_WIDTH = 0.34

/** 2 px indeterminate sweep. There is no percentage anywhere in the API, so never a determinate bar. */
function SweepBar({ color, track }: { color: string; track: string }) {
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(progress)
  }, [progress])
  const style = useAnimatedStyle(() => ({
    left: `${progress.value * (100 + SWEEP_WIDTH * 100) - SWEEP_WIDTH * 100}%`,
  }))
  return (
    <View style={[sweepStyles.track, { backgroundColor: track }]}>
      <Animated.View style={[sweepStyles.bar, { backgroundColor: color }, style]} />
    </View>
  )
}

const sweepStyles = StyleSheet.create({
  track: { height: 2, borderRadius: 1, overflow: 'hidden' },
  bar: { position: 'absolute', top: 0, height: 2, width: `${SWEEP_WIDTH * 100}%`, borderRadius: 1 },
})

export function WorkingCard({ session, title, serverLabel, serverColor, isFirst }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const { handlePress, handleLongPress } = useSessionRowActions(session)
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
      onPress={handlePress}
      onLongPress={handleLongPress}
      accessibilityLabel={`${title}, ${tierLabel}`}
      testID={`session-row-${session.id}`}
      isFirst={isFirst}
    >
      <StateBadge tier="working" qualifier={qualifier} />
      <SweepBar color={theme.status.running} track={trackColor(theme)} />
    </LiveCard>
  )
}

function trackColor(theme: Theme): string {
  return theme.bg.primary
}

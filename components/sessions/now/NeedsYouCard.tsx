import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme } from '@/contexts/ThemeContext'
import { StateBadge, getSessionTierLabel } from '@/components/sessions/StateBadge'
import { formatWaitSince, waitSinceIso } from '@/components/sessions/shared/formatCoarseElapsed'
import { shortPath } from '@/components/sessions/shared/pathTail'
import { useSessionRowActions } from '@/hooks/useSessionRowActions'
import { EndSessionStatus } from '@/components/sessions/EndSessionStatus'
import type { ProviderName } from '@/constants/providers'
import type { MultiSession } from '@/types/api'
import { LiveCard } from './LiveCard'

/** Wait stamps are fixed, so the card ticks locally or the number freezes. */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [enabled])
  return now
}

interface Props {
  session: MultiSession
  title: string
  serverLabel?: string | null
  serverColor?: string | null
  dominantProvider?: ProviderName
  isFirst?: boolean
}

/**
 * The only row that earns a whole card and an action line: a live process
 * waiting on the user. The mono block is the raw terminal tail, not a parsed
 * question — there is no answer affordance here by design.
 */
export function NeedsYouCard({ session, title, serverLabel, serverColor, dominantProvider, isFirst }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const styles = makeStyles(theme)
  const { handlePress, handleLongPress, handleMenuPress, overlays, endStatus } = useSessionRowActions(session, title)
  const stamp = waitSinceIso(session)
  const now = useNow(stamp != null)
  const wait = formatWaitSince(stamp, now)
  const qualifier = wait ? t('row.waitingFor', { elapsed: wait }) : undefined
  const tierLabel = getSessionTierLabel('needsYou', t)
  const accessibilityLabel = qualifier ? `${title}, ${tierLabel}, ${qualifier}` : `${title}, ${tierLabel}`
  const projectLabel = shortPath(session.projectPath)

  return (
    <LiveCard
      title={title}
      color={theme.status.waiting}
      emphasis="solid"
      serverLabel={serverLabel}
      serverColor={serverColor}
      provider={session.provider}
      dominantProvider={dominantProvider}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onMenuPress={handleMenuPress}
      accessibilityLabel={accessibilityLabel}
      testID={`session-row-${session.id}`}
      isFirst={isFirst}
    >
      <StateBadge tier="needsYou" qualifier={qualifier} />
      {session.lastOutput ? (
        <Text style={styles.output} numberOfLines={1}>{session.lastOutput}</Text>
      ) : null}
      <View style={styles.footer}>
        {projectLabel ? (
          <Text style={styles.footerMono} numberOfLines={1}>{projectLabel}</Text>
        ) : null}
        {session.branch ? (
          <>
            {projectLabel ? <Text style={styles.footerSep}>·</Text> : null}
            <Text style={styles.footerMono} numberOfLines={1}>{session.branch}</Text>
          </>
        ) : null}
        <Text style={styles.open}>{t('row.open')} →</Text>
      </View>
      <EndSessionStatus {...endStatus} />
      {overlays}
    </LiveCard>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    output: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      lineHeight: font.xs + 4,
      color: theme.text.primary,
      backgroundColor: theme.bg.primary,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm - 1,
      paddingHorizontal: spacing.sm,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    footerMono: {
      flexShrink: 1,
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      color: theme.text.secondary,
    },
    footerSep: { color: theme.text.secondary, opacity: 0.45, fontSize: font.xs },
    open: {
      marginStart: 'auto',
      color: theme.text.accent,
      fontSize: font.xs,
      fontWeight: '600',
    },
  })
}

import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme } from '@/contexts/ThemeContext'
import { StateBadge, getSessionTierLabel } from '@/components/sessions/StateBadge'
import { formatWaitingSince } from '@/components/sessions/shared/formatCoarseElapsed'
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

/** Last two path segments: `ai-tools/tb-mobile`. */
function shortPath(path: string): string {
  return path.split('/').filter(Boolean).slice(-2).join('/')
}

/**
 * The only row that earns a whole card and an action line: a live process
 * waiting on the user. The mono block is the raw terminal tail, not a parsed
 * question — there is no answer affordance here by design.
 */
export function NeedsYouCard({ session, title, serverLabel, serverColor, isFirst }: Props) {
  const theme = useTheme()
  const { t } = useTranslation('sessions')
  const styles = makeStyles(theme)
  const { handlePress, handleLongPress } = useSessionRowActions(session)
  const waitingFor = session.statusUpdatedAt
    ? t('row.waitingFor', { elapsed: formatWaitingSince(session.statusUpdatedAt) })
    : undefined
  const tierLabel = getSessionTierLabel('needsYou', t)

  return (
    <LiveCard
      title={title}
      color={theme.status.waiting}
      emphasis="solid"
      serverLabel={serverLabel}
      serverColor={serverColor}
      onPress={handlePress}
      onLongPress={handleLongPress}
      accessibilityLabel={`${title}, ${tierLabel}`}
      testID={`session-row-${session.id}`}
      isFirst={isFirst}
    >
      <StateBadge tier="needsYou" qualifier={waitingFor} />
      {session.lastOutput ? (
        <Text style={styles.output} numberOfLines={1}>{session.lastOutput}</Text>
      ) : null}
      <View style={styles.footer}>
        <Text style={styles.footerMono} numberOfLines={1}>{shortPath(session.projectPath)}</Text>
        {session.branch ? (
          <>
            <Text style={styles.footerSep}>·</Text>
            <Text style={styles.footerMono} numberOfLines={1}>{session.branch}</Text>
          </>
        ) : null}
        <Text style={styles.open}>{t('row.open')} →</Text>
      </View>
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

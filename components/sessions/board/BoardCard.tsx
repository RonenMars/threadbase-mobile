import { Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { font, spacing, type Theme } from '@/constants/theme'
import { MONO_FONT } from '@/constants/mono'
import { useTheme } from '@/contexts/ThemeContext'
import { StateBadge, getSessionTierLabel } from '@/components/sessions/StateBadge'
import { colorForToken } from '@/components/sessions/SessionStatusBadge'
import { LiveCard } from '@/components/sessions/now/LiveCard'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { shortPath } from '@/components/sessions/shared/pathTail'
import { useSessionRowActions } from '@/hooks/useSessionRowActions'
import { sessionLastActivityMs } from '@/lib/sessionBoard'
import { tierColorToken, type SessionTier } from '@/lib/sessionPresentation'
import type { ProviderName } from '@/constants/providers'
import { conversationHref } from '@/lib/conversationHref'
import type { MultiConversation, MultiSession } from '@/types/api'

interface Props {
  session: MultiSession
  title: string
  tier: SessionTier
  serverLabel?: string | null
  serverColor?: string | null
  dominantProvider?: ProviderName
}

/** Board card for the tiers the Now list renders as plain rows: observed, resumable, can't resume. */
export function BoardCard({ session, title, tier, serverLabel, serverColor, dominantProvider }: Props) {
  const theme = useTheme()
  const { t, i18n } = useTranslation('sessions')
  const styles = makeStyles(theme)
  const { handlePress, handleLongPress, handleMenuPress, overlays } = useSessionRowActions(session, title)
  const footer = [shortPath(session.projectPath), session.branch, session.model].filter(Boolean).join(' · ')
  const ms = sessionLastActivityMs(session)
  const time = ms > 0
    ? formatListTime(ms, { locale: i18n.language, labels: { now: t('hub.timeNow'), yesterday: t('hub.timeYesterday') } })
    : ''

  return (
    <LiveCard
      title={title}
      color={colorForToken(theme, tierColorToken(tier))}
      emphasis="faint"
      serverLabel={serverLabel}
      serverColor={serverColor}
      provider={session.provider}
      dominantProvider={dominantProvider}
      onPress={handlePress}
      onLongPress={handleLongPress}
      onMenuPress={handleMenuPress}
      accessibilityLabel={`${title}, ${getSessionTierLabel(tier, t)}`}
      testID={`session-row-${session.id}`}
    >
      <StateBadge tier={tier} qualifier={time || undefined} />
      {session.failureReason ? (
        <Text style={styles.failure} numberOfLines={1}>{session.failureReason}</Text>
      ) : null}
      {footer ? <Text style={styles.footer} numberOfLines={1}>{footer}</Text> : null}
      {overlays}
    </LiveCard>
  )
}

interface ConversationProps {
  conversation: MultiConversation
  title: string
  serverLabel?: string | null
  serverColor?: string | null
  dominantProvider?: ProviderName
}

/** Board card for a history conversation: nothing is running, so it carries a time and no state badge. */
export function BoardConversationCard({ conversation, title, serverLabel, serverColor, dominantProvider }: ConversationProps) {
  const theme = useTheme()
  const router = useRouter()
  const { t, i18n } = useTranslation('sessions')
  const styles = makeStyles(theme)
  const footer = [shortPath(conversation.projectPath), conversation.branch, conversation.model].filter(Boolean).join(' · ')
  const ms = Date.parse(conversation.lastActivity) || 0
  const time = ms > 0
    ? formatListTime(ms, { locale: i18n.language, labels: { now: t('hub.timeNow'), yesterday: t('hub.timeYesterday') } })
    : ''

  return (
    <LiveCard
      title={title}
      color={colorForToken(theme, tierColorToken('resumable'))}
      emphasis="faint"
      serverLabel={serverLabel}
      serverColor={serverColor}
      provider={conversation.provider}
      dominantProvider={dominantProvider}
      onPress={() => router.push(conversationHref(conversation.id, conversation.serverId))}
      accessibilityLabel={title}
      testID={`conversation-row-${conversation.id}`}
    >
      {time ? <Text style={styles.time}>{time}</Text> : null}
      {footer ? <Text style={styles.footer} numberOfLines={1}>{footer}</Text> : null}
    </LiveCard>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    failure: { fontSize: font.xs, color: theme.text.danger },
    time: { fontSize: font.xs, color: theme.text.secondary },
    footer: {
      fontFamily: MONO_FONT,
      fontSize: font.xs,
      color: theme.text.secondary,
      paddingTop: spacing.xs / 2,
    },
  })
}

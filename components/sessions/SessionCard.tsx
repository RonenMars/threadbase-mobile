import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { colorForToken } from './SessionStatusBadge'
import { StateBadge, getSessionTierLabel, isLiveTier } from './StateBadge'
import { MachineBadge } from './MachineBadge'
import { ServerChip } from '@/components/sessions/shared/ServerChip'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { formatWaitingSince } from '@/components/sessions/shared/formatCoarseElapsed'
import { sessionRowTitle } from '@/components/sessions/shared/rowTitle'
import { SERVER_COLOR_DEFAULT } from '@/components/sessions/shared/serverPalette'
import { Badge } from '@/components/ui/Badge'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import { FolderSimple } from 'phosphor-react-native'
import type { MultiSession } from '@/types/api'
import {
  deriveSessionPresentation,
  tierColorToken,
  type SessionPresentationInput,
} from '@/lib/sessionPresentation'
import { useSessionRowActions } from '@/hooks/useSessionRowActions'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'
import { useTranslation } from 'react-i18next'

interface Props {
  session: MultiSession
  isFirstSession?: boolean
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function SessionCard({ session, isFirstSession = false }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const multipleServers = useServersStore((s) => s.activeServerIds.length > 1)
  const serverColor = useServersStore((s) => s.servers[session.serverId]?.color) ?? SERVER_COLOR_DEFAULT
  const storedName = useSessionNamesStore((s) => s.getName(session.serverId, session.id))
  const storedOrigin = useSessionNamesStore((s) => s.getOrigin(session.serverId, session.id))
  const displayName = sessionRowTitle(session, { name: storedName, origin: storedOrigin })

  // An older server states no `ownership` but still sends `pid` for a process
  // it only discovered (managed PTY and historical shapes never carry one).
  // `deriveSessionPresentation` keys external strictly on `ownership`, so hand
  // it the legacy shape as external-alive rather than letting the badge and the
  // accessibility label each derive their own answer.
  const legacyDiscovered = session.ownership == null && session.pid != null
  const presentedSession: SessionPresentationInput = legacyDiscovered
    ? { ...session, ownership: 'external', processLiveness: 'alive' }
    : session
  const presentation = deriveSessionPresentation(presentedSession)
  const tierLabel = getSessionTierLabel(presentation.tier, t)
  const liveTier = isLiveTier(presentation.tier)
  // Thread spine: the tier colour while a process is live (amber needs-you,
  // green working, blue observed), then the server's identity colour when
  // multi-server, then brand blue. Echoes the brand mark; not a side-stripe.
  const spineColor = liveTier
    ? colorForToken(theme, tierColorToken(presentation.tier))
    : multipleServers
      ? serverColor
      : theme.text.accent
  // `statusUpdatedAt` is stamped on every status flip, so while the status is
  // `waiting_input` it is when the wait began.
  const waitingFor =
    presentation.tier === 'needsYou' && session.statusUpdatedAt
      ? t('row.waitingFor', { elapsed: formatWaitingSince(session.statusUpdatedAt) })
      : undefined

  const { handlePress, handleLongPress } = useSessionRowActions(session)

  const elapsedLabel = formatElapsed(session.elapsedMs)
  const promptsLabel = t('card.prompts', { count: session.promptCount })
  const lastActivityTs = session.completedAt ?? session.startedAt
  const timeLabel = lastActivityTs ? formatListTime(lastActivityTs) : null

  return (
    <View style={[styles.cardWrap, isGlass && styles.cardWrapGlass]} testID={isFirstSession ? "first-session-card" : undefined}>
      <GlassFill />
      <TouchableOpacity
        testID={`session-row-${session.id}`}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.75}
        accessibilityLabel={`Session ${displayName}, status ${tierLabel}, ${elapsedLabel}`}
        accessibilityRole="button"
        style={styles.touchable}
      >
        <View style={styles.row}>
          {/* Thread spine — structural column, brand-mark echo. */}
          <View style={[styles.spine, { backgroundColor: spineColor, opacity: liveTier ? 1 : 0.55 }]} />

          <View style={styles.body}>
            {/* Line 1: project name + trailing meta chips */}
            <View style={styles.titleRow}>
              <FolderSimple size={14} color={theme.text.secondary} weight="fill" />
              <Text style={styles.projectName} numberOfLines={1}>{displayName}</Text>
              <View style={styles.titleMeta}>
                {session.branch ? <Badge label={session.branch} /> : null}
                {session.machineName ? <MachineBadge machineName={session.machineName} /> : null}
                {multipleServers && session.serverLabel ? (
                  <ServerChip
                    label={session.serverLabel}
                    color={serverColor}
                    variant="label"
                  />
                ) : null}
                {timeLabel ? <Text style={styles.timeLabel}>{timeLabel}</Text> : null}
              </View>
            </View>

            {/* Line 2: status + runtime + prompts in mono. The bullets give
                the row a terminal-log rhythm without adding chrome. */}
            <View style={styles.statusRow}>
              <StateBadge tier={presentation.tier} qualifier={waitingFor} />
              <Text style={styles.metaSeparator}>•</Text>
              <Text style={styles.metaMono}>{elapsedLabel}</Text>
              <Text style={styles.metaSeparator}>•</Text>
              <Text style={styles.metaMono}>{promptsLabel}</Text>
            </View>

            {/* Line 3: last terminal output, mono, single line. Drop entirely
                if there's no output (rather than reserving empty space). */}
            {session.lastOutput ? (
              <Text style={styles.output} numberOfLines={1}>{session.lastOutput}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
  cardWrap: {
    marginBottom: spacing.sm,
    backgroundColor: theme.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden', // clip the spine to the card's rounded corners
  },
  cardWrapGlass: {
    backgroundColor: 'transparent',
  },
  touchable: {
    // Touchable is the press target; the row inside lays out spine + body.
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 64,
  },
  spine: {
    width: 3,
  },
  body: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs + 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  projectName: {
    color: theme.text.primary,
    fontSize: font.base,
    fontWeight: '600',
    flexShrink: 1,
  },
  titleMeta: {
    marginStart: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timeLabel: {
    color: theme.text.secondary,
    fontSize: font.xs,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flexWrap: 'wrap',
  },
  metaMono: {
    color: theme.text.secondary,
    fontSize: font.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
  },
  metaSeparator: {
    color: theme.text.secondary,
    fontSize: font.xs,
    opacity: 0.5,
  },
  output: {
    color: theme.text.secondary,
    fontSize: font.xs,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    opacity: 0.85,
  },
  })
}

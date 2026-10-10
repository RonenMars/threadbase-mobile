import { useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { CaretLeft } from 'phosphor-react-native'
import { BoardCard, BoardConversationCard } from '@/components/sessions/board/BoardCard'
import { BOARD_COLUMN_MIN_WIDTH, BoardColumn } from '@/components/sessions/board/BoardColumn'
import { NeedsYouCard } from '@/components/sessions/now/NeedsYouCard'
import { WorkingCard } from '@/components/sessions/now/WorkingCard'
import { colorForToken } from '@/components/sessions/SessionStatusBadge'
import { getSessionTierLabel } from '@/components/sessions/StateBadge'
import { resolveConversationRowTitle, resolveSessionRowTitle, storedNameFor } from '@/components/sessions/shared/rowTitle'
import { getActiveWithinLabel } from '@/components/servers/filterSortLabels'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { dedupeByServerAndId, useConversations } from '@/hooks/useConversations'
import { useEagerSessions } from '@/hooks/useSession'
import { SessionNamesSyncer } from '@/hooks/useSessionName'
import { goBackOrHub } from '@/lib/goBackOrHub'
import { useAppDirection } from '@/lib/rtl'
import { dominantProvider as findDominantProvider } from '@/lib/providerDominance'
import { BOARD_COLUMNS, bucketSessionsForBoard, type BoardColumnId, type BoardEntry } from '@/lib/sessionBoard'
import type { ActiveWithin } from '@/lib/sessionFilters'
import { tierColorToken, type SessionTier } from '@/lib/sessionPresentation'
import { useServersStore } from '@/stores/servers'
import { useSessionNamesStore } from '@/stores/sessionNames'

const WITHIN_OPTIONS: readonly ActiveWithin[] = ['today', '7d', '30d', 'any']

function getBoardColumnLabel(column: BoardColumnId, t: TFunction<['sessions', 'servers', 'common']>): string {
  switch (column) {
    case 'needsYou':
      return getSessionTierLabel('needsYou', t)
    case 'working':
      return getSessionTierLabel('working', t)
    case 'observed':
      return getSessionTierLabel('observed', t)
    case 'earlier':
      return t('sessions:board.earlier')
  }
}

function columnTier(column: BoardColumnId): SessionTier {
  return column === 'earlier' ? 'resumable' : column
}

export default function SessionBoard() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const router = useRouter()
  const { isRTL } = useAppDirection()
  const { t } = useTranslation(['sessions', 'servers', 'common'])
  const { t: tFilter } = useTranslation(['servers', 'settings', 'sessions'])
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const servers = useServersStore((s) => s.servers)
  const names = useSessionNamesStore((s) => s.names)
  const nameOrigins = useSessionNamesStore((s) => s.nameOrigin)
  const { sessions } = useEagerSessions()
  const [query, setQuery] = useState('')
  const [earlierWithin, setEarlierWithin] = useState<ActiveWithin>('today')

  const rows = useMemo(
    () =>
      sessions
        .filter((s) => displayedServerIds.includes(s.serverId))
        .map((session) => ({
          session,
          title: resolveSessionRowTitle(session, storedNameFor(names, nameOrigins, session.serverId, session.id)).title,
        })),
    [sessions, displayedServerIds, names, nameOrigins],
  )
  const convPages = useConversations(undefined, 0, { enabled: Platform.OS === 'web' })
  const conversations = useMemo(
    () =>
      dedupeByServerAndId((convPages.data?.pages ?? []).flatMap((p) => p.conversations)).map((conversation) => ({
        conversation,
        title: resolveConversationRowTitle(
          conversation,
          storedNameFor(names, nameOrigins, conversation.serverId, conversation.id),
        ).title,
      })),
    [convPages.data, names, nameOrigins],
  )
  const board = useMemo(
    () => bucketSessionsForBoard(rows, { query, earlierWithin, conversations }),
    [rows, query, earlierWithin, conversations],
  )
  const dominantProvider = useMemo(() => findDominantProvider(rows.map((r) => r.session.provider)), [rows])

  // History is paged newest first, so a bounded window is complete once a loaded
  // conversation falls outside it. "Any time" has no such edge and is not drained.
  const windowMayHaveMore = useMemo(
    () => earlierWithin !== 'any' && bucketSessionsForBoard([], { earlierWithin, conversations }).earlier.entries.length === conversations.length,
    [earlierWithin, conversations],
  )
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = convPages
  useEffect(() => {
    if (windowMayHaveMore && hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [windowMayHaveMore, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (Platform.OS !== 'web') return <Redirect href="/" />

  const multiServer = activeServerIds.length > 1
  const entryKey = (entry: BoardEntry) =>
    entry.kind === 'session'
      ? `${entry.session.serverId}::${entry.session.id}`
      : `${entry.conversation.serverId}::c::${entry.conversation.id}`
  const renderCard = (entry: BoardEntry) => {
    const { serverId, serverLabel } = entry.kind === 'session' ? entry.session : entry.conversation
    const chip = {
      serverLabel: multiServer ? (servers[serverId]?.label ?? serverLabel) : undefined,
      serverColor: servers[serverId]?.color,
      dominantProvider,
    }
    if (entry.kind === 'conversation') {
      return <BoardConversationCard conversation={entry.conversation} title={entry.title} {...chip} />
    }
    const { session, title, tier } = entry
    const shared = { session, title, ...chip }
    if (tier === 'needsYou') return <NeedsYouCard {...shared} />
    if (tier === 'working') return <WorkingCard {...shared} />
    return <BoardCard tier={tier} {...shared} />
  }

  // The bottom of Earlier is where a reader looks for older work, so the control there
  // widens the window one step at a time. Bounded windows page themselves; "Any time"
  // would drain the whole history, so each press there loads one more page.
  const widerWithin = WITHIN_OPTIONS[WITHIN_OPTIONS.indexOf(earlierWithin) + 1]
  const hasOlder = widerWithin ? board.earlier.entries.length < board.earlier.total || hasNextPage : hasNextPage
  const loadOlder = hasOlder ? (
    <Pressable
      onPress={() => (widerWithin ? setEarlierWithin(widerWithin) : void fetchNextPage())}
      disabled={isFetchingNextPage}
      accessibilityRole="button"
      testID="board-load-older"
      style={[styles.chip, styles.loadOlder, isFetchingNextPage && styles.loading]}
    >
      <Text style={styles.chipText}>{t('board.loadMore')}</Text>
    </Pressable>
  ) : null

  return (
    <View style={styles.screen} testID="board-screen">
      {activeServerIds.map((sid) => <SessionNamesSyncer key={sid} serverId={sid} />)}
      <View style={styles.header}>
        <Pressable
          onPress={() => goBackOrHub(router)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common:button.back')}
          testID="board-back"
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}
        >
          <CaretLeft size={20} color={theme.text.primary} weight="bold" mirrored={isRTL} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">{t('board.title')}</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('board.searchPlaceholder')}
          placeholderTextColor={theme.text.secondary}
          accessibilityLabel={t('search.accessibilityLabel')}
          style={styles.search}
          testID="board-search"
        />
        <View style={styles.within} accessibilityRole="radiogroup" accessibilityLabel={t('board.earlier')}>
          {WITHIN_OPTIONS.map((within) => {
            const selected = earlierWithin === within
            return (
              <Pressable
                key={within}
                onPress={() => setEarlierWithin(within)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                testID={`board-within-${within}`}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {getActiveWithinLabel(within, tFilter)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <ScrollView horizontal contentContainerStyle={styles.columns} style={styles.scroller}>
        {BOARD_COLUMNS.map((column) => (
          <BoardColumn
            key={column}
            label={getBoardColumnLabel(column, t)}
            color={colorForToken(theme, tierColorToken(columnTier(column)))}
            items={board[column].entries}
            renderItem={renderCard}
            keyExtractor={entryKey}
            total={board[column].total}
            emptyLabel={t('board.emptyColumn')}
            testID={`board-column-${column}`}
            footer={column === 'earlier' ? loadOlder : undefined}
          />
        ))}
      </ScrollView>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.bg.secondary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      backgroundColor: theme.bg.primary,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    back: { padding: spacing.xs },
    title: {
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '700',
      marginEnd: 'auto',
    },
    search: {
      width: 280,
      backgroundColor: theme.bg.card,
      color: theme.text.primary,
      fontSize: font.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    within: { flexDirection: 'row', gap: spacing.xs },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    chipSelected: { borderColor: theme.text.accent, backgroundColor: `${theme.text.accent}1f` },
    chipText: { color: theme.text.secondary, fontSize: font.sm, fontWeight: '500' },
    chipTextSelected: { color: theme.text.primary },
    loadOlder: { alignSelf: 'center', marginTop: spacing.sm },
    loading: { opacity: 0.5 },
    scroller: { flex: 1 },
    // A definite width makes the columns share the window instead of taking their content width;
    // the minWidth is what makes a narrow window scroll.
    columns: {
      width: '100%',
      minWidth: BOARD_COLUMNS.length * BOARD_COLUMN_MIN_WIDTH + (BOARD_COLUMNS.length - 1) * spacing.md + 2 * spacing.xl,
      gap: spacing.md,
      padding: spacing.xl,
    },
  })
}

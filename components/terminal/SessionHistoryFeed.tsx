import { useCallback, useMemo, useState } from 'react'
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View, type NativeSyntheticEvent, type TextInputSubmitEditingEventData } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { ArrowsIn, ArrowsOut, CaretDown, CaretUp, MagnifyingGlass } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { MessageItem } from '@/components/conversation/MessageItem'
import { HistoryLoadBoundary } from '@/components/conversation/HistoryLoadBoundary'
import { ConversationSearchView } from '@/components/conversation/ConversationSearchView'
import { RenderErrorBoundary } from '@/components/RenderErrorBoundary'
import { useConversation } from '@/hooks/useConversations'
import { SESSION_HISTORY_MAX_BYTES } from '@/constants/sessionHistory'
import { createApiForServer } from '@/services/api-client'
import { makeStyles as makeSearchStyles } from '@/components/sessions/SearchStyles'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'
import type { Message } from '@/types/api'

interface Props {
  serverId: string
  conversationId: string
  /** Full-screen reading mode: history fills the conversation-message area
   *  and the sibling terminal region is hidden (never unmounted). Owned by
   *  the parent (TerminalView) — toggling it also resizes the terminal, a
   *  sibling this component has no reach into. */
  isFull: boolean
  onToggleFull: () => void
}

interface SearchTargetResponse {
  query: string
  message_index: number
  uuid: string | null
  snippet: string
  match_indexes: number[]
  total_matches: number
}

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
}

// Same split ConversationHistoryList uses: FlashList v2's per-type height
// average is poisoned when a ~3,000pt last message shares a pool with 46pt
// reasoning headers, and the resulting content-size swing shoves the mVCP
// anchor (blank-gap / viewport-teleport while scrolling up).
function historyItemType(item: Message): string {
  let hasThinking = false
  let hasTool = false
  let hasDiff = false
  for (const b of item.content) {
    if (b.type === 'thinking') hasThinking = true
    else if (b.type === 'tool_use' || b.type === 'tool_result') hasTool = true
    else if (b.type === 'diff') hasDiff = true
  }
  if (hasDiff) return 'diff'
  if (hasTool) return 'tool'
  if (hasThinking) return 'thinking'
  return item.role === 'user' ? 'user' : 'assistant'
}

// Seeds the raw-terminal session view from the conversation, bounded by
// SESSION_HISTORY_MAX_BYTES — the terminal only ever holds its own live PTY
// scrollback (~1040 rows, and near-nothing right after a resume), so this is
// the only source for anything older. A separate region pinned above
// TerminalOutput: older pages prepend here, never into the terminal's own
// rows, which the live PTY tail is concurrently appending to and repainting.
// See docs/superpowers/specs/2026-08-15-session-history-byte-budget-design.md.
//
// Collapsible via a tap-only header (no drag handle): a resize gesture on
// the same surface as FlashList's own vertical pan is exactly the ambiguity
// that makes a drag-to-resize handle feel broken, so the toggle lives outside
// the scrollable area entirely. Always starts collapsed on a live-session
// visit — the terminal is the reason you're here, and an expanded strip
// would steal the first screenful. The choice is session-local, not written
// to viewPrefs, so leaving and re-entering a session opens closed again.
//
// A third state — full-screen — is reached via a maximize control reusing
// ChatComposer's ArrowsOut/ArrowsIn idiom. Maximize is only offered from
// mini, so minimizing always lands back on mini for this visit; the next
// visit still opens collapsed. `isFull` lives in the parent (TerminalView),
// which also owns hiding the sibling terminal region while full.
//
// In-feed search reuses the conversation screen's search-target resolver and
// ConversationSearchView (match nav + anchored window). Opening search from
// collapsed/mini enters full-screen so the match nav has a real reading
// surface; clearing search does not exit full — minimize is still there.
export function SessionHistoryFeed({ serverId, conversationId, isFull, onToggleFull }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const searchStyles = useMemo(() => makeSearchStyles(theme), [theme])
  const { t } = useTranslation('terminal')
  const { t: tSearch } = useTranslation('conversation')
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, totalMessages } = useConversation(
    serverId,
    conversationId,
    { maxBytes: SESSION_HISTORY_MAX_BYTES },
  )
  const [collapsed, setCollapsed] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  const [searchQuery, setSearchQuery] = useState<string | undefined>()

  const targetQuery = useQuery({
    queryKey: ['searchTarget', serverId, conversationId, searchQuery],
    queryFn: () => {
      if (!searchQuery) throw new Error('searchTarget: empty query')
      return createApiForServer(serverId).query<SearchTargetResponse>(
        `/api/conversations/${encodeURIComponent(conversationId)}/search-target`,
        { q: searchQuery },
      )
    },
    enabled: Boolean(searchQuery) && Boolean(serverId && conversationId),
    retry: false,
    staleTime: Infinity,
    meta: { persist: false },
  })

  const matchIndexes = targetQuery.data?.match_indexes
  const totalMatches = targetQuery.data?.total_matches
  const [matchPosOverride, setMatchPosOverride] = useState<{ forIndexes: number[]; pos: number } | null>(null)
  const activeMatchPos =
    matchIndexes && matchPosOverride?.forIndexes === matchIndexes
      ? matchPosOverride.pos
      : matchIndexes && matchIndexes.length > 0
        ? matchIndexes.length - 1
        : null

  const isResolvingTarget = Boolean(searchQuery) && targetQuery.isPending
  const anchorIndex =
    activeMatchPos != null && matchIndexes ? matchIndexes[activeMatchPos] : undefined

  const [fetchAnchor, setFetchAnchor] = useState<{ forIndexes: number[]; index: number } | null>(null)
  if (matchIndexes && anchorIndex != null && fetchAnchor?.forIndexes !== matchIndexes) {
    setFetchAnchor({ forIndexes: matchIndexes, index: anchorIndex })
  }
  const fetchAnchorIndex =
    matchIndexes && fetchAnchor?.forIndexes === matchIndexes ? fetchAnchor.index : anchorIndex

  const anchored = useConversation(serverId, conversationId, {
    anchorIndex: fetchAnchorIndex,
    enabled: Boolean(searchQuery) && !isResolvingTarget && fetchAnchorIndex != null,
  })

  const messages: Message[] = data?.messages ?? []
  const anchoredMessages: Message[] = anchored.data?.messages ?? []

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    if (!collapsed) setSearchOpen(false)
    setCollapsed((wasCollapsed) => !wasCollapsed)
  }, [collapsed])

  const handleToggleFull = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onToggleFull()
  }, [onToggleFull])

  const handleToggleSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    if (searchOpen) {
      setSearchOpen(false)
      return
    }
    setSearchOpen(true)
    if (!isFull) onToggleFull()
  }, [searchOpen, isFull, onToggleFull])

  const submitSearch = useCallback((event?: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    const trimmed = (event?.nativeEvent.text ?? searchDraft).trim()
    if (trimmed.length === 0) {
      setSearchQuery(undefined)
      setMatchPosOverride(null)
      setFetchAnchor(null)
      return
    }
    setSearchQuery(trimmed)
    setMatchPosOverride(null)
    setFetchAnchor(null)
  }, [searchDraft])

  const clearSearch = useCallback(() => {
    setSearchQuery(undefined)
    setSearchDraft('')
    setMatchPosOverride(null)
    setFetchAnchor(null)
  }, [])

  const handleStep = useCallback(
    (delta: 1 | -1, loadedRowIndex: number) => {
      if (!matchIndexes || matchIndexes.length === 0 || activeMatchPos == null) return
      const nextPos = (activeMatchPos + delta + matchIndexes.length) % matchIndexes.length
      setMatchPosOverride({ forIndexes: matchIndexes, pos: nextPos })
      if (loadedRowIndex === -1) {
        setFetchAnchor({ forIndexes: matchIndexes, index: matchIndexes[nextPos] })
      }
    },
    [matchIndexes, activeMatchPos],
  )

  // FlashList re-lays-out the header whenever the element identity changes,
  // and an inline JSX header recreates it on every parent render — during an
  // onStartReached page fetch that churn feeds extra mVCP anchor corrections
  // (Shopify/flash-list#1844). Memoized so identity only flips with fetch state.
  const listHeader = useMemo(
    () => <HistoryLoadBoundary hasOlder={Boolean(hasNextPage)} isFetching={isFetchingNextPage} />,
    [hasNextPage, isFetchingNextPage],
  )

  if (messages.length === 0) return null

  // message_pagination.total (the conversation's real size) rather than
  // messages.length (only what the byte-bounded seed has loaded so far) — a
  // 350-message conversation must not read "History · 60 messages" just
  // because that's what fit in the first page.
  const headerText = t('history.header', { count: totalMessages })
  const showList = isFull || !collapsed
  const showSearchView =
    Boolean(searchQuery) &&
    matchIndexes != null &&
    matchIndexes.length > 0 &&
    activeMatchPos != null &&
    anchorIndex != null &&
    anchoredMessages.length > 0
  const lastAnchoredId = anchoredMessages[anchoredMessages.length - 1]?.id

  const searchButton = (
    <TouchableOpacity
      style={[styles.iconButton, searchOpen ? styles.iconButtonActive : undefined]}
      onPress={handleToggleSearch}
      accessibilityRole="button"
      accessibilityLabel={tSearch('search.open')}
      testID="session-history-search-btn"
      hitSlop={8}
    >
      <MagnifyingGlass
        size={16}
        color={searchOpen ? theme.text.primary : theme.text.secondary}
      />
    </TouchableOpacity>
  )

  return (
    <View
      style={[styles.container, isFull ? styles.containerFull : showList ? styles.containerMini : undefined]}
      testID="session-history-feed"
    >
      {isFull ? (
        <View style={styles.header} testID="session-history-header">
          <Text style={styles.headerLabel}>{headerText}</Text>
          <View style={styles.headerActions}>
            {searchButton}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleToggleFull}
              accessibilityRole="button"
              accessibilityLabel={t('history.minimizeLabel')}
              testID="minimize-history-button"
              hitSlop={8}
            >
              <ArrowsIn size={16} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.header} testID="session-history-header">
          <Pressable
            style={styles.headerToggle}
            onPress={handleToggle}
            accessibilityRole="button"
            accessibilityLabel={collapsed ? t('history.expandLabel') : t('history.collapseLabel')}
            accessibilityState={{ expanded: !collapsed }}
            testID="session-history-toggle"
          >
            <Text style={styles.headerLabel}>{headerText}</Text>
          </Pressable>
          <View style={styles.headerTrailing}>
            {collapsed ? null : searchButton}
            <Pressable
              style={styles.iconButton}
              onPress={handleToggle}
              accessibilityRole="button"
              accessibilityLabel={collapsed ? t('history.expandLabel') : t('history.collapseLabel')}
              hitSlop={8}
              testID="session-history-chevron"
            >
              {collapsed ? (
                <CaretDown size={14} color={theme.text.secondary} weight="bold" />
              ) : (
                <CaretUp size={14} color={theme.text.secondary} weight="bold" />
              )}
            </Pressable>
            {collapsed ? null : (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleToggleFull}
                accessibilityRole="button"
                accessibilityLabel={t('history.maximizeLabel')}
                testID="expand-history-button"
                hitSlop={8}
              >
                <ArrowsOut size={16} color={theme.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {searchOpen && showList ? (
        <View style={searchStyles.searchBar} testID="session-history-search-bar">
          <TextInput
            testID="session-history-search-input"
            style={searchStyles.searchInput}
            value={searchDraft}
            onChangeText={setSearchDraft}
            onSubmitEditing={submitSearch}
            placeholder={tSearch('search.placeholder')}
            placeholderTextColor={theme.text.secondary}
            autoFocus={!searchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : null}
      {showSearchView && searchQuery && matchIndexes && activeMatchPos != null && anchorIndex != null ? (
        <View style={styles.list}>
          <ConversationSearchView
            key={`anchor-${fetchAnchorIndex}`}
            messages={anchoredMessages}
            lastMessageId={lastAnchoredId}
            searchQuery={searchQuery}
            matchIndexes={matchIndexes}
            totalMatches={totalMatches}
            anchorIndex={anchorIndex}
            activeMatchPos={activeMatchPos}
            onStep={handleStep}
            onClear={clearSearch}
            onStartReached={anchored.hasNextPage ? anchored.fetchNextPage : undefined}
            onEndReached={anchored.hasNewerPage ? anchored.fetchNewerPage : undefined}
            isFetchingOlder={anchored.isFetchingNextPage}
            isFetchingNewer={anchored.isFetchingNewerPage}
          />
        </View>
      ) : showList ? (
        <FlashList
          style={styles.list}
          testID="session-history-list"
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => (
            <RenderErrorBoundary tag="message_item" rawFallback={item.role}>
              <MessageItem message={item} isLast={index === messages.length - 1} />
            </RenderErrorBoundary>
          )}
          getItemType={historyItemType}
          // iOS default is 250px; a last message taller than 2× that hits
          // FlashList's known-bad mVCP-correction regime (Shopify/flash-list#2136)
          // and teleports the viewport back to the tail while scrolling up.
          drawDistance={2000}
          // startRenderingFromBottom opens on the latest seed. Do NOT set
          // autoscrollToBottomThreshold: this feed only prepends older pages,
          // it never live-appends, and that threshold is what snaps a reader
          // back to the last message after onStartReached fetches.
          maintainVisibleContentPosition={{ startRenderingFromBottom: true }}
          onStartReached={hasNextPage ? fetchNextPage : undefined}
          onStartReachedThreshold={0.3}
          ListHeaderComponent={listHeader}
        />
      ) : null}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    containerMini: {
      height: '35%',
    },
    containerFull: {
      flex: 1,
    },
    list: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerTrailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerToggle: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerLabel: {
      fontSize: font.xs,
      fontWeight: '600',
      color: theme.text.secondary,
      letterSpacing: 0.4,
    },
    iconButton: {
      padding: spacing.xs,
    },
    iconButtonActive: {
      backgroundColor: 'rgba(88,166,255,0.12)',
      borderRadius: 8,
    },
  })
}

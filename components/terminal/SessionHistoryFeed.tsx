import { useCallback } from 'react'
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { ArrowsIn, ArrowsOut, CaretDown, CaretUp } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { MessageItem } from '@/components/conversation/MessageItem'
import { HistoryLoadBoundary } from '@/components/conversation/HistoryLoadBoundary'
import { RenderErrorBoundary } from '@/components/RenderErrorBoundary'
import { useConversation } from '@/hooks/useConversations'
import { useViewPrefsStore } from '@/stores/viewPrefs'
import { SESSION_HISTORY_MAX_BYTES } from '@/constants/sessionHistory'
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

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true)
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
// the scrollable area entirely. Defaults to expanded — this region replaces
// what used to be no history at all, so the safer default keeps it visible;
// an explicit collapse is remembered (stores/viewPrefs.ts) and applies to
// every session, the same as the sessions-header and recents-accordion prefs.
//
// A third state — full-screen — is reached via a maximize control reusing
// ChatComposer's ArrowsOut/ArrowsIn idiom. It is intentionally NOT tracked in
// viewPrefs: collapsed/mini are standing preferences the user expects to
// carry into the next session, but full is a transient reading mode — if it
// persisted, every session would open with the terminal hidden, which is a
// far bigger commitment than a reading mode should make. `isFull` therefore
// lives in the parent (TerminalView), which also owns hiding the sibling
// terminal region while full; leaving the persisted collapsed pref untouched
// means minimizing always lands back on whatever state (mini or collapsed)
// was showing before maximize was pressed.
export function SessionHistoryFeed({ serverId, conversationId, isFull, onToggleFull }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('terminal')
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, totalMessages } = useConversation(
    serverId,
    conversationId,
    { maxBytes: SESSION_HISTORY_MAX_BYTES },
  )
  const storedCollapsed = useViewPrefsStore((s) => s.historyFeedCollapsed)
  const setHistoryFeedCollapsed = useViewPrefsStore((s) => s.setHistoryFeedCollapsed)
  const collapsed = storedCollapsed ?? false
  const messages: Message[] = data?.messages ?? []

  const handleToggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setHistoryFeedCollapsed(!collapsed)
  }, [collapsed, setHistoryFeedCollapsed])

  const handleToggleFull = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    onToggleFull()
  }, [onToggleFull])

  if (messages.length === 0) return null

  // message_pagination.total (the conversation's real size) rather than
  // messages.length (only what the byte-bounded seed has loaded so far) — a
  // 350-message conversation must not read "History · 60 messages" just
  // because that's what fit in the first page.
  const headerText = t('history.header', { count: totalMessages })
  const showList = isFull || !collapsed

  return (
    <View style={[styles.container, isFull && styles.containerFull]} testID="session-history-feed">
      {isFull ? (
        <View style={styles.header} testID="session-history-header">
          <Text style={styles.headerLabel}>{headerText}</Text>
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
      )}
      {showList ? (
        <FlashList
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => (
            <RenderErrorBoundary tag="message_item" rawFallback={item.role}>
              <MessageItem message={item} isLast={index === messages.length - 1} />
            </RenderErrorBoundary>
          )}
          maintainVisibleContentPosition={{ autoscrollToBottomThreshold: 0.2, startRenderingFromBottom: true }}
          onStartReached={hasNextPage ? fetchNextPage : undefined}
          onStartReachedThreshold={0.3}
          ListHeaderComponent={
            <HistoryLoadBoundary hasOlder={Boolean(hasNextPage)} isFetching={isFetchingNextPage} />
          }
        />
      ) : null}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      maxHeight: '35%',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    containerFull: {
      flex: 1,
      maxHeight: undefined,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    headerToggle: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
  })
}

import React, { useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Eye } from 'phosphor-react-native'
import { makeStyles as makeCardStyles } from '@/components/sessions/base/CollapsibleCard.styles'
import { CardBody, CardSpine, ChevronToggle, CountBadge } from '@/components/sessions/base/CollapsibleCardParts'
import { ConvRow } from '@/components/sessions/hub/ConvRow'
import type { NowEntry } from '@/components/sessions/now/nowEntries'
import { formatListTime } from '@/components/sessions/shared/formatListTime'
import { pathDisplay } from '@/components/sessions/shared/pathDisplay'
import { colorForToken } from '@/components/sessions/SessionStatusBadge'
import { getSessionTierLabel } from '@/components/sessions/StateBadge'
import { Card } from '@/components/ui/Card'
import { font, spacing, type Theme } from '@/constants/theme'
import { useThemedStyles } from '@/hooks/useThemedStyles'
import { useSessionRowActions } from '@/hooks/useSessionRowActions'
import { openPrompts, terminalTailLine } from '@/lib/boardPrompts'
import { conversationHref } from '@/lib/conversationHref'
import { useAppDirection } from '@/lib/rtl'
import { tierColorToken, type SessionTier } from '@/lib/sessionPresentation'
import { resolveSubagentLabel, type SubagentGroup } from '@/lib/subagents'
import { useNavLockStore } from '@/stores/navLock'
import type { MultiConversation, MultiSession } from '@/types/api'

interface Shared {
  id: string
  entry: NowEntry
  group: SubagentGroup | undefined
  isOpen: boolean
  onToggle: (id: string) => void
  serverIdFor: (rowId: string) => string
}

interface FrameProps extends Shared {
  rowId: string
  projectPath: string | null | undefined
  title: string
  tier: SessionTier | null
  ms: number
  onOpen: () => void
  onLongPress?: () => void
  /** A needs-you card: the line under the title, and what tapping it does. */
  needsYouLine?: { text: string; question: boolean; onPress: () => void }
}

function BoardCardFrame({
  id,
  rowId,
  group,
  isOpen,
  onToggle,
  serverIdFor,
  projectPath,
  title,
  tier,
  ms,
  onOpen,
  onLongPress,
  needsYouLine,
}: FrameProps) {
  const { t } = useTranslation('sessions')
  const { styles: card, theme } = useThemedStyles(makeCardStyles)
  const styles = useThemedStyles(makeStyles).styles
  const { isRTL } = useAppDirection()
  const subagentCount = group?.items.length ?? 0
  const parentLabel = pathDisplay(projectPath, { mode: 'smart' }).suffix || undefined
  const tierLabel = tier ? getSessionTierLabel(tier, t) : undefined
  const activity = [tierLabel, formatListTime(ms)].filter(Boolean).join(' · ')
  const needsYou = tier === 'needsYou'
  const waiting = theme.status.waiting
  const frameStyle = needsYou
    ? [styles.card, { borderColor: `${waiting}73`, backgroundColor: `${waiting}12` }]
    : styles.card

  return (
    <Card style={StyleSheet.flatten(frameStyle)} testID={`board-card-${rowId}`}>
      <View style={card.spineRow}>
        <CardSpine color={tier ? colorForToken(theme, tierColorToken(tier)) : null} />
        <View style={card.spineRowBody}>
          <View style={styles.head}>
            <Pressable
              style={({ pressed }) => [styles.open, needsYouLine && styles.openStacked, { opacity: pressed ? 0.6 : 1 }]}
              onPress={onOpen}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityLabel={t('boardTab.openSession', { title })}
              testID={`board-open-${rowId}`}
            >
              {parentLabel ? <Text style={card.headerParent} numberOfLines={1}>{parentLabel}</Text> : null}
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              {needsYouLine ? null : <Text style={card.headerActivity} numberOfLines={1}>{activity}</Text>}
            </Pressable>
            {subagentCount > 0 ? (
              <Pressable
                style={styles.toggle}
                onPress={() => onToggle(id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={t('boardTab.showSubagents', { count: subagentCount })}
                testID={`board-toggle-${rowId}`}
              >
                <View style={styles.counter}><CountBadge count={subagentCount} /></View>
                <View style={isRTL ? styles.mirrored : undefined}><ChevronToggle isOpen={isOpen} /></View>
              </Pressable>
            ) : null}
          </View>
          {needsYouLine ? (
            <Pressable
              style={styles.askRow}
              onPress={needsYouLine.onPress}
              accessibilityRole="button"
              accessibilityLabel={needsYouLine.question ? t('boardTab.showQuestion', { title }) : t('boardTab.openSession', { title })}
              testID={needsYouLine.question ? `board-question-${rowId}` : `board-tail-${rowId}`}
            >
              {needsYouLine.question ? <Eye size={16} color={waiting} /> : null}
              <Text style={needsYouLine.question ? styles.ask : styles.tail} numberOfLines={1}>{needsYouLine.text}</Text>
            </Pressable>
          ) : null}
          {isOpen && group ? (
            <CardBody>
              {group.items.map((c) => (
                <ConvRow key={c.id} conv={{ ...c, title: resolveSubagentLabel(c), serverId: serverIdFor(c.id) }} />
              ))}
            </CardBody>
          ) : null}
        </View>
      </View>
    </Card>
  )
}

/** A live session. Separate from the conversation card because its row actions are hooks bound to the session. */
function SessionCard({ session, onShowQuestion, ...shared }: Shared & { session: MultiSession; onShowQuestion: (session: MultiSession, title: string) => void }) {
  const { entry } = shared
  const title = entry.title.title
  const { handlePress, handleLongPress, overlays } = useSessionRowActions(session, title)
  const question = openPrompts(session)[0]?.questions[0]?.text
  const tail = terminalTailLine(session.lastOutput)
  const line = question ?? tail
  const needsYouLine =
    entry.tier === 'needsYou' && line
      ? { text: line, question: question !== undefined, onPress: question !== undefined ? () => onShowQuestion(session, title) : handlePress }
      : undefined
  return (
    <>
      <BoardCardFrame
        {...shared}
        rowId={session.id}
        projectPath={session.projectPath}
        title={title}
        tier={entry.tier}
        ms={entry.item.ms}
        onOpen={handlePress}
        onLongPress={handleLongPress}
        needsYouLine={needsYouLine}
      />
      {overlays}
    </>
  )
}

function ConversationCard({ conversation, ...shared }: Shared & { conversation: MultiConversation }) {
  const router = useRouter()
  const onOpen = useCallback(() => {
    useNavLockStore.getState().lock()
    router.push(conversationHref(conversation.id, conversation.serverId))
  }, [conversation.id, conversation.serverId, router])
  return (
    <BoardCardFrame
      {...shared}
      rowId={conversation.id}
      projectPath={conversation.projectPath}
      title={shared.entry.title.title}
      tier={shared.entry.tier}
      ms={shared.entry.item.ms}
      onOpen={onOpen}
    />
  )
}

/**
 * A board card. No sub-agents: the whole card opens the session. With some, the
 * counter and chevron fold them and the rest opens it. On Needs you the question
 * takes the activity line, so the card's height never depends on the wait.
 */
export function BoardSessionCard({ onShowQuestion, ...shared }: Shared & { onShowQuestion: (session: MultiSession, title: string) => void }) {
  const { item } = shared.entry
  return item.kind === 'session'
    ? <SessionCard {...shared} session={item.item} onShowQuestion={onShowQuestion} />
    : <ConversationCard {...shared} conversation={item.item} />
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    card: { overflow: 'hidden', gap: 0, padding: 0, marginBottom: 0 },
    head: { flexDirection: 'row', alignItems: 'stretch' },
    open: { flex: 1, minWidth: 0, minHeight: 64, justifyContent: 'center', gap: 2, paddingHorizontal: 12, paddingVertical: 10 },
    openStacked: { minHeight: 50, paddingBottom: 3 },
    title: { color: theme.text.primary, fontSize: font.base, lineHeight: 20, fontWeight: '600' },
    toggle: { minWidth: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingStart: 4, paddingEnd: 12 },
    counter: { minWidth: 24, alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999, backgroundColor: theme.bg.secondary },
    mirrored: { transform: [{ scaleX: -1 }] },
    askRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 27, paddingHorizontal: 12, paddingBottom: 9 },
    ask: { flex: 1, color: theme.status.waiting, fontSize: 12, lineHeight: 16, fontWeight: '600' },
    tail: { flex: 1, color: theme.text.secondary, fontSize: 12, lineHeight: 16 },
  })
}

import React, { useRef, useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet'
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist'
import { PaperPlaneRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useSessionsStore } from '@/stores/sessions'
import type { QueuedPrompt } from '@/types/api'

function statusColors(theme: Theme): Record<QueuedPrompt['status'], string> {
  return {
    pending: theme.text.secondary,
    running: theme.status.running,
    completed: theme.status.completed,
    cancelled: theme.status.failed,
  }
}

const EMPTY_QUEUE: QueuedPrompt[] = []

interface Props {
  serverId: string
  sessionId: string
  visible: boolean
  onClose: () => void
}

export function PromptQueueSheet({ serverId, sessionId, visible, onClose }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const STATUS_COLORS = statusColors(theme)
  const { t } = useTranslation('queue')
  const sheetRef = useRef<BottomSheet>(null)
  const [input, setInput] = useState('')
  const queueKey = `${serverId}::${sessionId}`
  // Select the raw slot; fall back outside the selector so we never return a
  // fresh [] each render (Zustand v5 uses Object.is, which would loop).
  const rawQueue = useSessionsStore((s) => s.promptQueues[queueKey])
  const queue = rawQueue ?? EMPTY_QUEUE
  const reorderQueue = useSessionsStore((s) => s.reorderQueue)
  const { addToQueue, removeFromQueue } = useSessionActions(serverId, sessionId)

  const snapPoints = ['50%', '85%']

  const handleAddToQueue = useCallback(() => {
    if (!input.trim()) return
    addToQueue.mutate(input.trim())
    setInput('')
  }, [input, addToQueue])

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<QueuedPrompt>) => (
      <TouchableOpacity
        onLongPress={drag}
        style={[styles.queueItem, isActive && styles.queueItemActive]}
        activeOpacity={0.8}
      >
        <View style={styles.queueItemLeft}>
          <Text style={[styles.queueStatus, { color: STATUS_COLORS[item.status] }]}>
            {item.status === 'pending' ? '●' : item.status === 'running' ? '▶' : item.status === 'completed' ? '✓' : '✕'}
          </Text>
          <Text style={styles.queueText} numberOfLines={2}>{item.text}</Text>
        </View>
        {item.status === 'pending' ? (
          <TouchableOpacity
            onPress={() => removeFromQueue.mutate(item.id)}
            style={styles.removeBtn}
          >
            <Text style={styles.removeBtnText}>{t('promptQueue.remove')}</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    ),
    [removeFromQueue, t]
  )

  if (!visible) return null

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('promptQueue.title')}</Text>
          <Text style={styles.subtitle}>{t('promptQueue.pending', { count: queue.filter((p) => p.status === 'pending').length })}</Text>
        </View>

        <View style={styles.inputRow}>
          <BottomSheetTextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Add a prompt to queue..."
            placeholderTextColor={theme.text.secondary}
            multiline
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !input.trim() && styles.addBtnDisabled]}
            onPress={handleAddToQueue}
            disabled={!input.trim()}
            accessibilityLabel="Add prompt to queue"
          >
            <PaperPlaneRight size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <DraggableFlatList
          data={queue}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => reorderQueue(serverId, sessionId, data)}
          style={styles.list}
        />
      </BottomSheetView>
    </BottomSheet>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    sheetBg: { backgroundColor: theme.bg.secondary },
    handle: { backgroundColor: theme.border },
    content: { flex: 1, padding: spacing.md, gap: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600' },
    subtitle: { color: theme.text.secondary, fontSize: font.sm },
    inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
    input: {
      flex: 1,
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text.primary,
      fontSize: font.base,
      padding: spacing.sm,
      maxHeight: 120,
    },
    addBtn: {
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      minWidth: 48,
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addBtnDisabled: { opacity: 0.4 },
    list: { flex: 1 },
    queueItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.xs,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
    },
    queueItemActive: { opacity: 0.7, transform: [{ scale: 1.02 }] },
    queueItemLeft: { flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    queueStatus: { fontSize: font.base, width: 20 },
    queueText: { color: theme.text.primary, fontSize: font.sm, flex: 1 },
    removeBtn: { padding: spacing.xs, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    removeBtnText: { color: theme.status.failed, fontSize: font.sm },
  })
}

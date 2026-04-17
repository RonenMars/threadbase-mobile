import React, { useRef, useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet'
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist'
import { dark, font, radius, spacing } from '@/constants/theme'
import { useSessionActions } from '@/hooks/useSessionActions'
import { useSessionsStore } from '@/stores/sessions'
import type { QueuedPrompt } from '@/types/api'

const STATUS_COLORS: Record<QueuedPrompt['status'], string> = {
  pending: dark.text.secondary,
  running: dark.status.running,
  completed: dark.status.completed,
  cancelled: dark.status.failed,
}

interface Props {
  serverId: string
  sessionId: string
  visible: boolean
  onClose: () => void
}

export function PromptQueueSheet({ serverId, sessionId, visible, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null)
  const [input, setInput] = useState('')
  const queueKey = `${serverId}::${sessionId}`
  const queue = useSessionsStore((s) => s.promptQueues[queueKey] ?? [])
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
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    ),
    [removeFromQueue]
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
          <Text style={styles.title}>Prompt Queue</Text>
          <Text style={styles.subtitle}>{queue.filter((p) => p.status === 'pending').length} pending</Text>
        </View>

        <View style={styles.inputRow}>
          <BottomSheetTextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Add a prompt to queue..."
            placeholderTextColor={dark.text.secondary}
            multiline
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !input.trim() && styles.addBtnDisabled]}
            onPress={handleAddToQueue}
            disabled={!input.trim()}
          >
            <Text style={styles.addBtnText}>Add</Text>
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

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: dark.bg.secondary },
  handle: { backgroundColor: dark.border },
  content: { flex: 1, padding: spacing.md, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: dark.text.primary, fontSize: font.lg, fontWeight: '600' },
  subtitle: { color: dark.text.secondary, fontSize: font.sm },
  inputRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  input: {
    flex: 1,
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    color: dark.text.primary,
    fontSize: font.base,
    padding: spacing.sm,
    maxHeight: 120,
  },
  addBtn: {
    backgroundColor: dark.text.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: font.base },
  list: { flex: 1 },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: dark.border,
    minHeight: 44,
  },
  queueItemActive: { opacity: 0.7, transform: [{ scale: 1.02 }] },
  queueItemLeft: { flex: 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  queueStatus: { fontSize: font.base, width: 20 },
  queueText: { color: dark.text.primary, fontSize: font.sm, flex: 1 },
  removeBtn: { padding: spacing.xs, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: dark.status.failed, fontSize: font.sm },
})

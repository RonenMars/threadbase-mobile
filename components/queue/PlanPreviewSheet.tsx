import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { dark, font, radius, spacing } from '@/constants/theme'
import { useSessionActions } from '@/hooks/useSessionActions'

const AUTO_PROCEED_TIMEOUT_MS = 60000

interface Props {
  sessionId: string
  plan: string
  visible: boolean
  onClose: () => void
}

export function PlanPreviewSheet({ sessionId, plan, visible, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null)
  const { respondToPlan } = useSessionActions(sessionId)
  const [editMode, setEditMode] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(AUTO_PROCEED_TIMEOUT_MS / 1000))

  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          respondToPlan.mutate('proceed')
          onClose()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [visible])

  if (!visible) return null

  const handleProceed = () => {
    respondToPlan.mutate('proceed')
    onClose()
  }

  const handleEdit = () => {
    if (!editMode) {
      setEditMode(true)
      setEditedPrompt('')
      return
    }
    respondToPlan.mutate('edit', editedPrompt)
    onClose()
  }

  const handleCancel = () => {
    respondToPlan.mutate('cancel')
    onClose()
  }

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['75%', '95%']}
      enablePanDownToClose={false}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Plan Preview</Text>
          <Text style={styles.timer}>Auto-proceed in {secondsLeft}s</Text>
        </View>

        <View style={styles.planBox}>
          <Text style={styles.planText} selectable>{plan}</Text>
        </View>

        {editMode ? (
          <TextInput
            style={styles.editInput}
            value={editedPrompt}
            onChangeText={setEditedPrompt}
            placeholder="Edit the prompt before proceeding..."
            placeholderTextColor={dark.text.secondary}
            multiline
            autoFocus
          />
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnProceed} onPress={handleProceed}>
            <Text style={styles.btnProceedText}>▶ Proceed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnEdit} onPress={handleEdit}>
            <Text style={styles.btnEditText}>✏️ {editMode ? 'Send Edit' : 'Edit Prompt'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={handleCancel}>
            <Text style={styles.btnCancelText}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: dark.bg.secondary },
  handle: { backgroundColor: dark.border },
  content: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: dark.text.primary, fontSize: font.xl, fontWeight: '700' },
  timer: { color: dark.text.secondary, fontSize: font.sm },
  planBox: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    padding: spacing.md,
  },
  planText: { color: dark.text.primary, fontSize: font.base, lineHeight: 22 },
  editInput: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.text.accent,
    color: dark.text.primary,
    fontSize: font.base,
    padding: spacing.md,
    minHeight: 100,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btnProceed: {
    flex: 1,
    backgroundColor: dark.status.running,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  btnProceedText: { color: '#fff', fontWeight: '700', fontSize: font.base },
  btnEdit: {
    flex: 1,
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnEditText: { color: dark.text.primary, fontSize: font.base },
  btnCancel: {
    flex: 1,
    backgroundColor: `${dark.status.failed}20`,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.status.failed,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnCancelText: { color: dark.status.failed, fontSize: font.base },
})

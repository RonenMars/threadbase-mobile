import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useGlassSheetBackground } from '@/components/ui/GlassSheet'
import { useSessionActions } from '@/hooks/useSessionActions'

const AUTO_PROCEED_TIMEOUT_MS = 60000

interface Props {
  serverId: string
  sessionId: string
  plan: string
  visible: boolean
  onClose: () => void
}

export function PlanPreviewSheet({ serverId, sessionId, plan, visible, onClose }: Props) {
  const theme = useTheme()
  const glassBackground = useGlassSheetBackground()
  const styles = makeStyles(theme)
  const { t } = useTranslation('queue')
  const sheetRef = useRef<BottomSheet>(null)
  const { respondToPlan } = useSessionActions(serverId, sessionId)
  const [editMode, setEditMode] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(AUTO_PROCEED_TIMEOUT_MS / 1000))

  // Route `respondToPlan` (a React Query mutation — new reference every render)
  // and `onClose` through refs so the 1Hz interval isn't torn down and rebuilt
  // every render. Effect depends only on `visible`.
  const respondRef = useRef(respondToPlan)
  const onCloseRef = useRef(onClose)
  useEffect(() => { respondRef.current = respondToPlan })
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!visible) return
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval)
          respondRef.current.mutate({ action: 'proceed' })
          onCloseRef.current()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [visible])

  if (!visible) return null

  const handleProceed = () => {
    respondToPlan.mutate({ action: 'proceed' })
    onClose()
  }

  const handleEdit = () => {
    if (!editMode) {
      setEditMode(true)
      setEditedPrompt('')
      return
    }
    respondToPlan.mutate({ action: 'edit', editedPrompt })
    onClose()
  }

  const handleCancel = () => {
    respondToPlan.mutate({ action: 'cancel' })
    onClose()
  }

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['75%', '95%']}
      enablePanDownToClose={false}
      backgroundStyle={styles.sheetBg}
      backgroundComponent={glassBackground}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('planPreview.title')}</Text>
          <Text style={styles.timer}>{t('planPreview.autoProceed', { seconds: secondsLeft })}</Text>
        </View>

        <View style={styles.planBox}>
          <Text style={styles.planText} selectable>{plan}</Text>
        </View>

        {editMode ? (
          <BottomSheetTextInput
            style={styles.editInput}
            value={editedPrompt}
            onChangeText={setEditedPrompt}
            placeholder={t('planPreview.editPlaceholder')}
            placeholderTextColor={theme.text.secondary}
            multiline
            autoFocus
          />
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnProceed} onPress={handleProceed}>
            <Text style={styles.btnProceedText}>{t('planPreview.proceed')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnEdit} onPress={handleEdit}>
            <Text style={styles.btnEditText}>{editMode ? t('planPreview.sendEdit') : t('planPreview.editPrompt')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={handleCancel}>
            <Text style={styles.btnCancelText}>{t('planPreview.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    sheetBg: { backgroundColor: theme.bg.secondary },
    handle: { backgroundColor: theme.border },
    content: { padding: spacing.lg, gap: spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: theme.text.primary, fontSize: font.xl, fontWeight: '700' },
    timer: { color: theme.text.secondary, fontSize: font.sm },
    planBox: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
    },
    planText: { color: theme.text.primary, fontSize: font.base, lineHeight: 22 },
    editInput: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.text.accent,
      color: theme.text.primary,
      fontSize: font.base,
      padding: spacing.md,
      minHeight: 100,
    },
    actions: { flexDirection: 'row', gap: spacing.sm },
    btnProceed: {
      flex: 1,
      backgroundColor: theme.status.running,
      borderRadius: radius.md,
      padding: spacing.sm,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    btnProceedText: { color: '#fff', fontWeight: '700', fontSize: font.base },
    btnEdit: {
      flex: 1,
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      padding: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
      justifyContent: 'center',
    },
    btnEditText: { color: theme.text.primary, fontSize: font.base },
    btnCancel: {
      flex: 1,
      backgroundColor: `${theme.status.failed}20`,
      borderRadius: radius.md,
      padding: spacing.sm,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.status.failed,
      minHeight: 44,
      justifyContent: 'center',
    },
    btnCancelText: { color: theme.status.failed, fontSize: font.base },
  })
}

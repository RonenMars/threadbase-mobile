import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'

type Action = 'escape' | 'up' | 'down' | 'left' | 'right' | 'tab' | 'shift_tab' | 'enter'

interface Props {
  promptId?: string
  busy?: boolean
  onClose: () => void
  onSend: (action: Action, confirm?: true) => void
}

export function RemoteKeyboardControls({ promptId, busy = false, onClose, onSend }: Props) {
  const { t } = useTranslation('terminal')
  const { theme } = useTheme()
  const styles = makeStyles(theme)
  const key = (label: string, action: Action, confirm?: true) => (
    <Pressable key={action} style={[styles.key, busy && styles.disabled]} disabled={busy || (action !== 'escape' && !promptId)} onPress={() => onSend(action, confirm)} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  )
  return (
    <View style={styles.panel} testID="remote-keyboard-controls">
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t('rawKeyboard.title')}</Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('rawKeyboard.close')}><X size={22} color={theme.text.secondary} /></Pressable>
      </View>
      <View style={styles.row}>{key(t('rawKeyboard.escape'), 'escape')}{key(t('rawKeyboard.tab'), 'tab')}{key(t('rawKeyboard.shiftTab'), 'shift_tab')}</View>
      <View style={styles.row}>{key('←', 'left')}{key('↑', 'up')}{key('→', 'right')}</View>
      <View style={styles.row}>{key('↓', 'down')}</View>
      <Pressable style={[styles.confirm, (!promptId || busy) && styles.disabled]} disabled={!promptId || busy} onLongPress={() => onSend('enter', true)} delayLongPress={700} accessibilityRole="button" accessibilityLabel={t('rawKeyboard.confirmLabel')}>
        <Text style={styles.confirmText}>{t('rawKeyboard.confirm')}</Text>
      </Pressable>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    panel: { backgroundColor: theme.bg.card, borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.sm },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: theme.text.primary, fontSize: 15, fontWeight: '600' },
    row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
    key: { alignItems: 'center', backgroundColor: theme.bg.secondary, borderRadius: 10, justifyContent: 'center', minHeight: 52, minWidth: 76, paddingHorizontal: spacing.md },
    keyText: { color: theme.text.primary, fontSize: 17, fontWeight: '600' },
    confirm: { alignItems: 'center', backgroundColor: theme.text.accent, borderRadius: 10, justifyContent: 'center', minHeight: 52 },
    confirmText: { color: theme.text.onAccent, fontSize: 15, fontWeight: '600' },
    disabled: { opacity: 0.45 },
  })
}

import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
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
  const theme = useTheme()
  const styles = makeStyles(theme)
  const key = (label: string, action: Action, confirm?: true) => (
    <Pressable
      key={action}
      testID={`remote-key-${action}`}
      style={[styles.key, busy && styles.disabled]}
      disabled={busy}
      onPress={() => onSend(action, confirm)}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  )
  return (
    <View style={styles.panel} testID="remote-keyboard-controls">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="always"
      >
        {key(t('rawKeyboard.escape'), 'escape')}
        {key(t('rawKeyboard.tab'), 'tab')}
        {key(t('rawKeyboard.shiftTab'), 'shift_tab')}
        {/* Arrow glyphs are the key itself, not copy to translate. */}
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {key('←', 'left')}
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {key('↑', 'up')}
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {key('↓', 'down')}
        {/* eslint-disable-next-line i18next/no-literal-string */}
        {key('→', 'right')}
        <Pressable
          testID="remote-key-enter"
          style={[styles.key, busy && styles.disabled]}
          disabled={busy}
          onPress={() => onSend('enter', promptId ? true : undefined)}
          accessibilityRole="button"
          accessibilityLabel={t('rawKeyboard.enter')}
        >
          <Text style={styles.keyText}>{t('rawKeyboard.enter')}</Text>
        </Pressable>
        {promptId ? (
          <Pressable
            style={[styles.confirm, busy && styles.disabled]}
            disabled={busy}
            onLongPress={() => onSend('enter', true)}
            delayLongPress={700}
            accessibilityRole="button"
            accessibilityLabel={t('rawKeyboard.confirmLabel')}
          >
            <Text style={styles.confirmText}>{t('rawKeyboard.confirm')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <Pressable
        onPress={onClose}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('rawKeyboard.close')}
        style={styles.close}
      >
        <X size={20} color={theme.text.secondary} />
      </Pressable>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    // One compact row that rides the keyboard, so typing and special keys are
    // never a mode switch; it scrolls when the keys outrun a narrow screen.
    panel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingEnd: spacing.xs },
    key: { alignItems: 'center', backgroundColor: theme.bg.secondary, borderRadius: 8, justifyContent: 'center', minHeight: 40, minWidth: 48, paddingHorizontal: spacing.sm },
    keyText: { color: theme.text.primary, fontSize: 15, fontWeight: '600' },
    close: { minHeight: 40, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
    confirm: { alignItems: 'center', backgroundColor: theme.text.accent, borderRadius: 8, justifyContent: 'center', minHeight: 40, paddingHorizontal: spacing.md },
    confirmText: { color: theme.text.onAccent, fontSize: 14, fontWeight: '600' },
    disabled: { opacity: 0.45 },
  })
}

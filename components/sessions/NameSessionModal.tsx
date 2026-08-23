import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import { useDirectionStyle } from '@/lib/rtl'

interface Props {
  visible: boolean
  mode: 'create' | 'exit'
  currentName?: string
  onSave: (name: string) => void
  onCancel: () => void
}

export function NameSessionModal({ visible, mode, currentName, onSave, onCancel }: Props) {
  const { t } = useTranslation(['sessions', 'common'])
  const theme = useTheme()
  const styles = makeStyles(theme)
  const directionStyle = useDirectionStyle()
  const [name, setName] = useState('')

  useEffect(() => {
    if (visible) {
      queueMicrotask(() => {
        setName('')
      })
    }
  }, [visible])

  const title = mode === 'create' ? t('nameSession.createTitle') : t('nameSession.exitTitle')
  const saveLabel = mode === 'create' ? t('nameSession.start') : t('common:button.save')

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        style={[styles.overlay, directionStyle]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          {mode === 'exit' && currentName ? (
            <Text style={styles.hint}>{`Current: "${currentName}"`}</Text>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder={t('nameSession.placeholder')}
            placeholderTextColor={theme.text.secondary}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.75}>
              <Text style={styles.cancelLabel}>{t('common:button.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.75}>
              <Text style={styles.saveLabel}>{saveLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: theme.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: theme.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
  },
  hint: {
    color: theme.text.secondary,
    fontSize: font.sm,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: theme.bg.secondary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: theme.text.primary,
    fontSize: font.base,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  cancelLabel: {
    color: theme.text.secondary,
    fontSize: font.base,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: theme.text.accent,
    alignItems: 'center',
  },
  saveLabel: {
    color: theme.text.onAccent,
    fontSize: font.base,
    fontWeight: '600',
  },
  })
}

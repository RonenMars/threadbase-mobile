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
import { dark, font, radius, spacing } from '@/constants/theme'

interface Props {
  visible: boolean
  mode: 'create' | 'exit'
  currentName?: string
  onSave: (name: string) => void
  onCancel: () => void
}

export function NameSessionModal({ visible, mode, currentName, onSave, onCancel }: Props) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (visible) {
      queueMicrotask(() => {
        setName('')
      })
    }
  }, [visible])

  const title = mode === 'create' ? 'Name this session?' : 'Name this session before you go?'
  const saveLabel = mode === 'create' ? 'Start' : 'Save'

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          {mode === 'exit' && currentName ? (
            <Text style={styles.hint}>{`Current: "${currentName}"`}</Text>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="e.g. Fix auth bug"
            placeholderTextColor={dark.text.secondary}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.75}>
              <Text style={styles.cancelLabel}>Cancel</Text>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: dark.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: dark.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    color: dark.text.primary,
    fontSize: font.lg,
    fontWeight: '600',
  },
  hint: {
    color: dark.text.secondary,
    fontSize: font.sm,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: dark.bg.secondary,
    borderWidth: 1,
    borderColor: dark.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: dark.text.primary,
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
    borderColor: dark.border,
    alignItems: 'center',
  },
  cancelLabel: {
    color: dark.text.secondary,
    fontSize: font.base,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: dark.text.accent,
    alignItems: 'center',
  },
  saveLabel: {
    color: dark.bg.primary,
    fontSize: font.base,
    fontWeight: '600',
  },
})

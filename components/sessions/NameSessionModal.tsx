import React, { useState } from 'react'
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
  onSkip: () => void
  onDontAskAgain: () => void
}

export function NameSessionModal({ visible, mode, currentName, onSave, onSkip, onDontAskAgain }: Props) {
  const [name, setName] = useState('')
  const [dontAsk, setDontAsk] = useState(false)

  const title = mode === 'create' ? 'Name this session?' : 'Name this session before you go?'
  const skipLabel = mode === 'create' ? 'Skip' : 'Leave as is'
  const saveLabel = mode === 'create' ? 'Start' : 'Save'

  function handleSkip() {
    if (dontAsk) onDontAskAgain()
    onSkip()
  }

  function handleSave() {
    if (dontAsk) onDontAskAgain()
    onSave(name.trim())
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
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.75}>
              <Text style={styles.skipLabel}>{skipLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.75}>
              <Text style={styles.saveLabel}>{saveLabel}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.checkboxRow} onPress={() => setDontAsk((v) => !v)} activeOpacity={0.7}>
            <View style={[styles.checkbox, dontAsk && styles.checkboxChecked]}>
              {dontAsk ? <View style={styles.checkboxInner} /> : null}
            </View>
            <Text style={styles.checkboxLabel}>{"Don't ask me again"}</Text>
          </TouchableOpacity>
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: dark.text.accent,
    backgroundColor: dark.text.accent,
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: dark.bg.card,
  },
  checkboxLabel: {
    color: dark.text.secondary,
    fontSize: font.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    alignItems: 'center',
  },
  skipLabel: {
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

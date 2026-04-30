import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { dark, font, radius, spacing } from '@/constants/theme'
import type { SlashCommand } from '@/constants/slashCommands'

interface Props {
  command: SlashCommand | null
  onConfirm: (command: SlashCommand, arg: string) => void
  onDismiss: () => void
}

export function SlashCommandArgModal({ command, onConfirm, onDismiss }: Props) {
  const [arg, setArg] = useState('')

  // Reset arg whenever a new command is shown
  useEffect(() => {
    if (command) setArg('')
  }, [command?.id])

  if (!command) return null

  const canConfirm = arg.trim().length > 0

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(command, arg.trim())
  }

  return (
    <Modal
      visible={!!command}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <KeyboardAvoidingView
        style={styles.outer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name={command.icon as any}
                  size={18}
                  color={dark.text.accent}
                />
              </View>
              <View>
                <Text style={styles.commandName}>/{command.id}</Text>
                <Text style={styles.commandDesc} numberOfLines={1}>
                  {command.description}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onDismiss} hitSlop={8} accessibilityLabel="Cancel">
              <Ionicons name="close" size={20} color={dark.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Arg input */}
          <View style={styles.body}>
            <Text style={styles.inputLabel}>
              {command.argLabel ?? command.title}
            </Text>
            <TextInput
              style={styles.input}
              value={arg}
              onChangeText={setArg}
              placeholder={command.argPlaceholder ?? ''}
              placeholderTextColor={dark.text.secondary}
              autoFocus
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={handleConfirm}
            />
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onDismiss}
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              accessibilityLabel={`Run /${command.id}`}
            >
              <Ionicons name="paper-plane" size={15} color="#fff" />
              <Text style={styles.confirmBtnText}>Run /{command.id}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    backgroundColor: dark.bg.secondary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: dark.border,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: dark.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: `${dark.text.accent}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commandName: {
    color: dark.text.accent,
    fontSize: font.base,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  commandDesc: {
    color: dark.text.secondary,
    fontSize: font.sm,
    marginTop: 1,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  inputLabel: {
    color: dark.text.secondary,
    fontSize: font.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  input: {
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    color: dark.text.primary,
    fontSize: font.base,
    padding: spacing.sm,
    minHeight: 44,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: dark.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: dark.border,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: dark.text.secondary,
    fontSize: font.base,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: dark.text.accent,
    borderRadius: radius.md,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: {
    color: '#fff',
    fontSize: font.base,
    fontWeight: '600',
  },
})

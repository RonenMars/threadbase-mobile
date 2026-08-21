import React, { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { X, PaperPlaneRight } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { GlassFill } from '@/components/ui/GlassFill'
import type { SlashCommand } from '@/constants/slashCommands'

interface Props {
  command: SlashCommand | null
  onConfirm: (command: SlashCommand, arg: string) => void
  onDismiss: () => void
}

export function SlashCommandArgModal({ command, onConfirm, onDismiss }: Props) {
  const { t } = useTranslation(['shared', 'common'])
  const theme = useTheme()
  const isGlass = useIsGlass()
  const styles = makeStyles(theme)
  const [arg, setArg] = useState('')

  // Reset arg whenever a new command is shown
  useEffect(() => {
    if (command) queueMicrotask(() => setArg(''))
    // Effect keyed on command.id; the full `command` is read from the closure
    // intentionally and should not re-trigger when only its other fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <KeyboardAwareScrollView
        style={styles.outer}
        contentContainerStyle={styles.outerContent}
        keyboardShouldPersistTaps="handled"
        bottomOffset={8}
      >
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View style={[styles.card, isGlass && styles.cardGlass]} pointerEvents="box-none">
          <GlassFill />
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconWrap}>
                <command.icon size={18} color={theme.text.accent} />
              </View>
              <View>
                <Text style={styles.commandName}>/{command.id}</Text>
                <Text style={styles.commandDesc} numberOfLines={1}>
                  {command.description}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onDismiss} hitSlop={8} accessibilityLabel={t('common:button.cancel')}>
              <X size={20} color={theme.text.secondary} />
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
              placeholderTextColor={theme.text.secondary}
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
              accessibilityLabel={t('common:button.cancel')}
            >
              <Text style={styles.cancelBtnText}>{t('common:button.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              accessibilityLabel={`Run /${command.id}`}
            >
              <PaperPlaneRight size={15} color="#fff" />
              <Text style={styles.confirmBtnText}>{t('commands.run', { command: command.id })}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    outer: {
      flex: 1,
    },
    outerContent: {
      flexGrow: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    card: {
      backgroundColor: theme.bg.secondary,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: theme.border,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    cardGlass: {
      backgroundColor: 'transparent',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
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
      backgroundColor: `${theme.text.accent}18`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commandName: {
      color: theme.text.accent,
      fontSize: font.base,
      fontWeight: '700',
      fontFamily: 'monospace',
    },
    commandDesc: {
      color: theme.text.secondary,
      fontSize: font.sm,
      marginTop: 1,
    },
    body: {
      paddingHorizontal: spacing.lg,
      gap: spacing.xs,
    },
    inputLabel: {
      color: theme.text.secondary,
      fontSize: font.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: '600',
    },
    input: {
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text.primary,
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
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      color: theme.text.secondary,
      fontSize: font.base,
    },
    confirmBtn: {
      flex: 2,
      flexDirection: 'row',
      backgroundColor: theme.text.accent,
      borderRadius: radius.md,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    confirmBtnDisabled: { opacity: 0.4 },
    confirmBtnText: {
      color: theme.text.onAccent,
      fontSize: font.base,
      fontWeight: '600',
    },
  })
}

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useKeyboardState } from 'react-native-keyboard-controller'
import {
  ImageIcon as PhosphorImage,
  X,
  Paperclip,
  PaperPlaneRight,
  Microphone,
  MicrophoneSlash,
  ArrowsOut,
  ArrowsIn,
} from 'phosphor-react-native'
import type { UploadedFile } from '@/services/uploads'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'

export interface ChatComposerProps {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  onAttach: () => void
  attachments: UploadedFile[]
  onRemoveAttachment: (id: string) => void
  isUploading: boolean
  attachError: string | null
  sendError: string | null
  /** Calm, non-failure notice shown in the same slot as sendError (e.g. a
   *  question that closed itself) — not styled as a failure. */
  sendNotice?: string | null
  disabled: boolean
  /**
   * Send only. Typing, the mic and attachments stay live on purpose: a question
   * card is up and the answer belongs on the card, but blocking the rest buys
   * nothing, punishes someone drafting their next message, and widens the
   * lockout surface if anything about the card goes wrong.
   */
  sendDisabled?: boolean
  voice: { listening: boolean; start: () => Promise<void>; stop: () => void }
  micGranted: boolean
  onToggleMic: () => void
}

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onAttach,
  attachments,
  onRemoveAttachment,
  isUploading,
  attachError,
  sendError,
  sendNotice = null,
  disabled,
  sendDisabled = false,
  voice,
  micGranted,
  onToggleMic,
}: ChatComposerProps) {
  const { t } = useTranslation('terminal')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  // When the keyboard is up, behavior="padding" already lifts the composer above
  // it — the home indicator is covered, so any resting safe-area padding would
  // double-count and leave a visible gap. Use a small fixed gap instead; when
  // the keyboard is closed, the safe-area inset alone clears the home
  // indicator (floored at spacing.sm for devices reporting a zero inset).
  const keyboardVisible = useKeyboardState((s) => s.isVisible)
  const inputAreaPaddingBottom = keyboardVisible
    ? spacing.sm
    : Math.max(insets.bottom, spacing.sm)
  const [expanded, setExpanded] = useState(false)

  const hasContent = value.trim().length > 0 || attachments.length > 0

  // Both send buttons funnel through here — the inline one and the one in the
  // full-screen modal. They each disable themselves as well; this is the guard
  // that survives someone adding a third.
  const handleSend = () => {
    if (disabled || sendDisabled || !hasContent) return
    Keyboard.dismiss()
    onSend()
  }

  const chips =
    attachments.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {attachments.map((a) => (
          <View key={a.id} style={styles.chip}>
            <PhosphorImage size={14} color={theme.text.primary} />
            <Text style={styles.chipText} numberOfLines={1}>
              {a.originalName}
            </Text>
            <TouchableOpacity
              onPress={() => onRemoveAttachment(a.id)}
              accessibilityLabel={`Remove ${a.originalName}`}
              hitSlop={8}
            >
              <X size={14} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    ) : null

  const errors = (
    <>
      {sendError ? (
        <Text style={styles.sendError} numberOfLines={2}>
          {sendError}
        </Text>
      ) : null}
      {sendNotice ? (
        <Text style={styles.sendNotice} numberOfLines={2}>
          {sendNotice}
        </Text>
      ) : null}
      {attachError ? (
        <Text style={styles.sendError} numberOfLines={2}>
          {attachError}
        </Text>
      ) : null}
    </>
  )

  const attachButton = (
    <TouchableOpacity
      testID="chat-attach-button"
      style={[styles.iconBtn, (isUploading || disabled) && styles.disabled]}
      onPress={onAttach}
      disabled={isUploading || disabled}
      accessibilityLabel={t('input.attachLabel')}
      hitSlop={8}
    >
      {isUploading ? (
        <ActivityIndicator size="small" color={theme.text.primary} />
      ) : (
        <Paperclip size={24} color={theme.text.primary} />
      )}
    </TouchableOpacity>
  )

  const trailingButton = hasContent ? (
    <TouchableOpacity
      testID="chat-send-button"
      style={[styles.sendBtn, (disabled || sendDisabled) && styles.disabled]}
      onPress={handleSend}
      disabled={disabled || sendDisabled}
      accessibilityLabel={t('action.sendInput')}
    >
      <PaperPlaneRight size={24} color={theme.text.onAccent} />
    </TouchableOpacity>
  ) : micGranted ? (
    <TouchableOpacity
      testID="chat-mic-button"
      style={[styles.sendBtn, disabled && styles.disabled]}
      onPress={onToggleMic}
      disabled={disabled}
      accessibilityLabel={voice.listening ? t('voice.stop') : t('voice.start')}
    >
      {voice.listening ? (
        <MicrophoneSlash size={24} color={theme.text.onAccent} />
      ) : (
        <Microphone size={24} color={theme.text.onAccent} />
      )}
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      testID="chat-send-button"
      style={[styles.sendBtn, styles.disabled]}
      disabled
      accessibilityLabel={t('action.sendInput')}
    >
      <PaperPlaneRight size={24} color={theme.text.onAccent} />
    </TouchableOpacity>
  )

  return (
    <View style={[styles.inputArea, { paddingBottom: inputAreaPaddingBottom }]}>
      {errors}
      {chips}
      <View style={styles.inputRow}>
        {attachButton}
        {Platform.OS === 'android' ? (
          <View style={styles.inputWrapper}>
            <TextInput
              testID="chat-message-input"
              style={[styles.input, disabled && styles.disabled]}
              value={disabled ? '' : value}
              onChangeText={disabled ? undefined : onChangeText}
              placeholder={disabled ? t('status.starting') : t('input.placeholder')}
              placeholderTextColor={theme.text.secondary}
              multiline
              scrollEnabled
              textAlignVertical="top"
              editable={!disabled}
            />
            <TouchableOpacity
              testID="expand-input-button"
              accessibilityRole="button"
              accessibilityLabel={t('input.expandLabel')}
              style={styles.expandBtnAndroid}
              onPress={() => setExpanded(true)}
              disabled={disabled}
              hitSlop={8}
            >
              <ArrowsOut size={18} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TextInput
              testID="chat-message-input"
              style={[styles.input, disabled && styles.disabled]}
              value={disabled ? '' : value}
              onChangeText={disabled ? undefined : onChangeText}
              placeholder={disabled ? t('status.starting') : t('input.placeholder')}
              placeholderTextColor={theme.text.secondary}
              multiline
              scrollEnabled
              textAlignVertical="top"
              editable={!disabled}
            />
            <TouchableOpacity
              testID="expand-input-button"
              accessibilityRole="button"
              accessibilityLabel={t('input.expandLabel')}
              style={styles.expandBtn}
              onPress={() => setExpanded(true)}
              disabled={disabled}
              hitSlop={8}
            >
              <ArrowsOut size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </>
        )}
        {trailingButton}
      </View>

      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.flex} edges={['top']}>
            <View
              style={[
                styles.inputArea,
                styles.inputAreaExpanded,
                { paddingBottom: inputAreaPaddingBottom },
              ]}
            >
              {errors}
              {chips}
              <TextInput
                testID="message-input-expanded"
                style={[styles.inputExpandedField, disabled && styles.disabled]}
                value={disabled ? '' : value}
                onChangeText={disabled ? undefined : onChangeText}
                placeholder={disabled ? t('status.starting') : t('input.placeholder')}
                placeholderTextColor={theme.text.secondary}
                multiline
                textAlignVertical="top"
                autoFocus
                editable={!disabled}
              />
              <View style={styles.expandedToolbar}>
                <TouchableOpacity
                  testID="minimize-input-button"
                  style={styles.iconBtn}
                  onPress={() => setExpanded(false)}
                  accessibilityLabel={t('input.minimizeLabel')}
                  hitSlop={8}
                >
                  <ArrowsIn size={22} color={theme.text.primary} />
                </TouchableOpacity>
                {attachButton}
                <TouchableOpacity
                  style={[styles.iconBtn, disabled && styles.disabled]}
                  onPress={onToggleMic}
                  disabled={disabled}
                  accessibilityLabel={voice.listening ? t('voice.stop') : t('voice.start')}
                  hitSlop={8}
                >
                  {voice.listening ? (
                    <MicrophoneSlash size={26} color={theme.status.failed} />
                  ) : (
                    <Microphone size={26} color={theme.text.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sendBtn, (!hasContent || disabled || sendDisabled) && styles.disabled]}
                  onPress={() => {
                    handleSend()
                    setExpanded(false)
                  }}
                  disabled={!hasContent || disabled || sendDisabled}
                  accessibilityLabel={t('action.sendInput')}
                >
                  <PaperPlaneRight size={26} color={theme.text.onAccent} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    flex: { flex: 1 },
    modalContainer: { flex: 1, backgroundColor: theme.bg.primary },
    inputArea: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      padding: spacing.sm,
      gap: spacing.sm,
      backgroundColor: theme.bg.primary,
    },
    inputAreaExpanded: { flex: 1, borderTopWidth: 0 },
    sendError: { color: theme.status.failed, fontSize: font.sm },
    sendNotice: { color: theme.text.secondary, fontSize: font.sm },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
    input: {
      flex: 1,
      backgroundColor: theme.bg.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text.primary,
      fontSize: font.base,
      padding: spacing.sm,
      maxHeight: 160,
      minHeight: 44,
    },
    inputExpandedField: {
      flex: 1,
      backgroundColor: theme.bg.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text.primary,
      fontSize: font.base,
      padding: spacing.sm,
    },
    expandBtn: { justifyContent: 'flex-end', alignSelf: 'flex-end', paddingBottom: spacing.sm, paddingHorizontal: spacing.xs },
    inputWrapper: { flex: 1, position: 'relative' },
    expandBtnAndroid: { position: 'absolute', top: 4, right: 4 },
    expandedToolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xs },
    iconBtn: {
      width: 52,
      backgroundColor: theme.bg.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendBtn: {
      width: 52,
      backgroundColor: theme.text.accent,
      borderRadius: 10,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    chipsRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: theme.bg.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      maxWidth: 200,
    },
    chipText: { color: theme.text.primary, fontSize: font.xs, flexShrink: 1 },
    disabled: { opacity: 0.4 },
  })
}

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
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
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
  disabled: boolean
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
  disabled,
  voice,
  micGranted,
  onToggleMic,
}: ChatComposerProps) {
  const { t } = useTranslation('terminal')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const insets = useSafeAreaInsets()
  const [expanded, setExpanded] = useState(false)

  const hasContent = value.trim().length > 0 || attachments.length > 0

  const handleSend = () => {
    if (disabled || !hasContent) return
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
      accessibilityLabel="Attach file"
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
      style={[styles.sendBtn, disabled && styles.disabled]}
      onPress={handleSend}
      disabled={disabled}
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
    <View style={[styles.inputArea, { paddingBottom: spacing.xl + insets.bottom }]}>
      {errors}
      {chips}
      <View style={styles.inputRow}>
        {attachButton}
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
          accessibilityLabel="Expand input"
          style={styles.expandBtn}
          onPress={() => setExpanded(true)}
          disabled={disabled}
          hitSlop={8}
        >
          <ArrowsOut size={20} color={theme.text.secondary} />
        </TouchableOpacity>
        {trailingButton}
      </View>

      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
            <View
              style={[
                styles.inputArea,
                styles.inputAreaExpanded,
                { paddingBottom: spacing.xl + insets.bottom },
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
                  accessibilityLabel="Minimize input"
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
                  style={[styles.sendBtn, (!hasContent || disabled) && styles.disabled]}
                  onPress={() => {
                    handleSend()
                    setExpanded(false)
                  }}
                  disabled={!hasContent || disabled}
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

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  View,
  Text,
  TextInput,
  type TextInputInstance,
  type TextInputKeyPressEvent,
  type TextInputSelectionChangeEvent,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated'
import { useKeyboardInset } from '@/hooks/useKeyboardInset'
import {
  ImageIcon as PhosphorImage,
  X,
  Paperclip,
  PaperPlaneRight,
  Microphone,
  MicrophoneSlash,
  ArrowsOut,
  ArrowsIn,
  Sparkle,
  Quotes,
} from 'phosphor-react-native'
import { isPreviewableImage, type ComposerAttachment } from '@/services/uploads'
import { lendComposerFocus, returnComposerFocus, useComposerFocus } from '@/hooks/useComposerFocus'
import { AttachmentPreview } from '@/components/conversation/AttachmentPreview'
import { FileMentionPanel, SkillMentionPanel } from '@/components/conversation/FileMentionBoard'
import type { ComposerMention, ComposerSlash } from '@/hooks/useFileMentions'
import type { SkillEntry } from '@/lib/slashToken'
import { useTheme } from '@/contexts/ThemeContext'
import { font, spacing, type Theme } from '@/constants/theme'
import { layoutDirectionStyle, ltrContentStyle, textDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'

export interface ChatComposerProps {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  onAttach: () => void
  /** Aborts an in-flight upload; when given, the spinner becomes a stop button. */
  onCancelUpload?: () => void
  attachments: ComposerAttachment[]
  onRemoveAttachment: (id: string) => void
  /** Quoted message shown as a removable tag; it rides along with the next send. */
  quote?: string | null
  onClearQuote?: () => void
  isUploading: boolean
  attachError: string | null
  sendError: string | null
  /** One tappable recovery under sendError, for a refusal the user can only
   *  get past by doing something other than retrying (e.g. sending Escape to
   *  a prompt the server still thinks is open). */
  sendErrorAction?: { label: string; onPress: () => void } | null
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
  /** Ghost next-prompt suggestion. Null or absent renders no chip. */
  promptSuggestion?: string | null
  /** Tap on the chip: send the suggestion as-is. */
  onSendSuggestion?: (text: string) => void
  /** Long-press on the chip: put the suggestion in the input instead of sending. */
  onFillSuggestion?: (text: string) => void
  /** Rides the keyboard with the composer: the raw-keys row, when it is open.
   *  It sits above the composer's own safe-area padding, so that padding stays
   *  the single owner of the bottom inset. */
  accessory?: React.ReactNode
  /** Open `@` mention under the cursor; null closes the file picker. */
  mention?: ComposerMention | null
  /** Caret to apply once, after a mention is inserted. */
  selection?: { start: number; end: number }
  onSelectionChange?: (e: TextInputSelectionChangeEvent) => void
  /** Open `/` token at the start of the prompt; null closes the skills picker. */
  slash?: ComposerSlash | null
  /** The marked skill: its name at the start of the text shows in the accent color with an X. */
  skill?: SkillEntry | null
  onClearSkill?: () => void
  /** Replaces the default placeholder, e.g. with the question a "Chat about this" left open. */
  placeholder?: string | null
  /** Focuses the inline input whenever this changes after mount. */
  focusRequest?: number
}

const CHIP_THUMB_SIZE = 20

// Falls back to the generic icon when the file can't be decoded (e.g. a format the platform has no codec for).
function AttachmentChipIcon({ attachment, theme }: { attachment: ComposerAttachment; theme: Theme }) {
  const [failed, setFailed] = useState(false)
  if (!isPreviewableImage(attachment) || failed) return <PhosphorImage size={14} color={theme.text.primary} />
  return (
    <Image
      testID={`attachment-chip-thumb-${attachment.id}`}
      source={{ uri: attachment.localUri }}
      style={{ width: CHIP_THUMB_SIZE, height: CHIP_THUMB_SIZE, borderRadius: 4 }}
      resizeMode="cover"
      accessible={false}
      onError={() => setFailed(true)}
    />
  )
}

// A style object may not be shared between components, so each area calls this.
function useKeyboardGapPadding(restingPad: number) {
  const { progress } = useReanimatedKeyboardAnimation()
  return useAnimatedStyle(() => ({
    paddingBottom: restingPad + (spacing.sm - restingPad) * progress.value,
  }))
}

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onAttach,
  onCancelUpload,
  attachments,
  onRemoveAttachment,
  quote = null,
  onClearQuote,
  isUploading,
  attachError,
  sendError,
  sendErrorAction = null,
  sendNotice = null,
  disabled,
  sendDisabled = false,
  voice,
  micGranted,
  onToggleMic,
  promptSuggestion = null,
  onSendSuggestion,
  onFillSuggestion,
  accessory = null,
  mention = null,
  selection,
  onSelectionChange,
  slash = null,
  skill = null,
  onClearSkill,
  placeholder = null,
  focusRequest,
}: ChatComposerProps) {
  const { t } = useTranslation('terminal')
  const { t: tCommon } = useTranslation('common')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const inputDirection = textDirectionStyle(direction)
  const insets = useSafeAreaInsets()
  // `useKeyboardInset` lifts the whole surface by the keyboard height, so while
  // the keyboard is up the home indicator is covered and the resting safe-area
  // padding would double-count. The gap therefore shrinks to spacing.sm as the
  // keyboard arrives — interpolated on the same animation that drives the lift,
  // because a discrete switch jumps by insets.bottom − spacing.sm (26 pt on a
  // notched iPhone) at the start of every open and the end of every close.
  const restingPad = Math.max(insets.bottom, spacing.sm)
  const inputAreaPadding = useKeyboardGapPadding(restingPad)
  const expandedInputAreaPadding = useKeyboardGapPadding(restingPad)
  const [expanded, setExpanded] = useState(false)
  const expandedKeyboardInset = useKeyboardInset()

  // iOS sometimes drops the software keyboard across a background/foreground
  // cycle even though the TextInput never lost first-responder state, so
  // nothing else tells it to resurface. That restore, and the ones an overlay
  // owes when it closes, are decided by the focus machine.
  const inputRef = useRef<TextInputInstance>(null)
  const expandedInputRef = useRef<TextInputInstance>(null)
  const firstFocusRequest = useRef(focusRequest)
  useEffect(() => {
    if (focusRequest === firstFocusRequest.current) return
    firstFocusRequest.current = undefined
    inputRef.current?.focus()
  }, [focusRequest])
  const { onInputFocus, onInputBlur, onExpand, onMinimize } = useComposerFocus({
    inlineRef: inputRef,
    expandedRef: expandedInputRef,
    disabled,
  })

  // Sending from the expanded editor hands focus back to the inline input, but
  // only if the editor had it — preserving focus must never summon a keyboard
  // that wasn't up. The focus machine owns that decision (`minimize` from
  // `typing(expanded)`); what is deferred here is only *when* it is asked, because
  // neither platform can move focus while the editor is still on screen: iOS
  // detaches the inline input until the slide-out ends (onDismiss, iOS-only) and
  // Android's Dialog holds window focus until it goes (the post-close effect).
  const minimizeOnCloseRef = useRef(false)
  const minimizeIfPending = useCallback(() => {
    if (!minimizeOnCloseRef.current) return
    minimizeOnCloseRef.current = false
    onMinimize()
  }, [onMinimize])
  useEffect(() => {
    if (!expanded && Platform.OS === 'android') minimizeIfPending()
  }, [expanded, minimizeIfPending])

  const hasContent = value.trim().length > 0 || attachments.length > 0

  // Both send buttons funnel through here — the inline one and the one in the
  // full-screen modal. They each disable themselves as well; this is the guard
  // that survives someone adding a third. Sending leaves focus as it was: the
  // user keeps composing (keyboard decision D1, docs/audits/composer-keyboard/).
  const handleSend = () => {
    if (disabled || sendDisabled || !hasContent) return
    onSend()
  }

  // Web: Enter sends and Shift+Enter keeps the textarea's newline, as in any desktop chat.
  // Handled here rather than via blurOnSubmit, which react-native-web follows with a blur.
  // An open IME composition owns Enter (it commits the candidate), so it is left alone.
  const onWebKeyPress =
    Platform.OS === 'web'
      ? (e: TextInputKeyPressEvent & { nativeEvent: { shiftKey?: boolean; isComposing?: boolean } }) => {
          const { key, shiftKey, isComposing } = e.nativeEvent
          if (key !== 'Enter' || shiftKey || isComposing) return
          e.preventDefault()
          handleSend()
        }
      : undefined

  const suggestionChip =
    promptSuggestion !== null &&
    !hasContent &&
    !disabled &&
    !sendDisabled &&
    onSendSuggestion !== undefined &&
    onFillSuggestion !== undefined ? (
      <TouchableOpacity
        testID="prompt-suggestion-chip"
        style={styles.suggestionChip}
        onPress={() => onSendSuggestion(promptSuggestion)}
        onLongPress={() => {
          onFillSuggestion(promptSuggestion)
          inputRef.current?.focus()
        }}
        accessibilityRole="button"
        accessibilityLabel={t('input.suggestionLabel', { text: promptSuggestion })}
        accessibilityHint={t('input.suggestionHint')}
      >
        <Sparkle size={14} color={theme.text.accent} />
        <Text style={[styles.suggestionText, inputDirection]} numberOfLines={1}>
          {promptSuggestion}
        </Text>
      </TouchableOpacity>
    ) : null

  const boardsAllowed = !disabled && !voice.listening
  const mentionBoard =
    (boardsAllowed && mention !== null ? <FileMentionPanel mention={mention} /> : null) ??
    (boardsAllowed && slash !== null ? <SkillMentionPanel slash={slash} /> : null)

  // A controlled TextInput takes styled children in place of `value`; that is
  // how the skill name gets its color. The X sits at the name's top end, found
  // by measuring the name in the input's font (it is always the first word).
  // Native multiline sizing stops growing once the empty draft pinned the height, so
  // the height follows the reported content size, clamped to the style's min/max.
  const [contentHeight, setContentHeight] = useState(0)
  const grownHeight =
    value.length === 0 || contentHeight === 0
      ? undefined
      : Math.min(160, Math.max(44, contentHeight + (Platform.OS === 'android' ? spacing.sm * 2 : 0)))
  const [skillWidth, setSkillWidth] = useState(0)
  const markedSkill = skill !== null && !disabled && value.startsWith(skill.name) ? skill : null
  const inputChildren = markedSkill ? (
    <>
      <Text testID="skill-chip-name" style={styles.skillName}>{markedSkill.name}</Text>
      <Text>{value.slice(markedSkill.name.length)}</Text>
    </>
  ) : undefined
  const inputValue = markedSkill ? undefined : disabled ? '' : value
  const skillClear = (testID: string) =>
    markedSkill && onClearSkill ? (
      <TouchableOpacity
        testID={testID}
        style={[styles.skillClear, { start: spacing.sm + skillWidth - 6 }]}
        onPress={onClearSkill}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('skills.clear', { name: markedSkill.name })}
      >
        <X size={8} weight="bold" color={theme.text.onAccent} />
      </TouchableOpacity>
    ) : null
  const skillMeasure = markedSkill ? (
    <Text
      style={styles.skillMeasure}
      onLayout={(e) => setSkillWidth(e.nativeEvent.layout.width)}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {markedSkill.name}
    </Text>
  ) : null

  const previewImages = attachments.filter(isPreviewableImage)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  // Borrows focus like the attach sheet does, so closing the preview hands the
  // keyboard back to the message being written.
  const openPreview = (attachmentId: string) => {
    const index = previewImages.findIndex((img) => img.id === attachmentId)
    if (index < 0) return
    lendComposerFocus('attach')
    setPreviewIndex(index)
  }
  const closePreview = () => {
    setPreviewIndex(null)
    returnComposerFocus('attach')
  }
  // iOS presents one modal at a time from a given presenter, so while the
  // expanded editor is up the preview has to be mounted inside it.
  const preview = <AttachmentPreview images={previewImages} openIndex={previewIndex} onClose={closePreview} />

  const quoteChip = quote ? (
    <View style={[styles.chip, styles.quoteChip]}>
      <Quotes size={14} color={theme.text.secondary} weight="fill" />
      <Text testID="quote-chip" style={styles.chipText} numberOfLines={1}>
        {quote}
      </Text>
      <TouchableOpacity
        testID="quote-chip-remove"
        onPress={onClearQuote}
        accessibilityRole="button"
        accessibilityLabel={t('input.removeQuoteLabel')}
        hitSlop={8}
      >
        <X size={14} color={theme.text.secondary} />
      </TouchableOpacity>
    </View>
  ) : null

  const chips =
    attachments.length > 0 ? (
      <ScrollView
        testID="attachment-chips"
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        {attachments.map((a) => (
          <View key={a.id} style={styles.chip}>
            <TouchableOpacity
              testID={`attachment-chip-${a.id}`}
              style={styles.chipBody}
              onPress={() => openPreview(a.id)}
              disabled={!isPreviewableImage(a)}
              accessibilityRole="button"
              accessibilityLabel={t('preview.openLabel', { name: a.originalName })}
            >
              <AttachmentChipIcon attachment={a} theme={theme} />
              <Text style={[styles.chipText, ltrContentStyle]} numberOfLines={1}>
                {a.originalName}
              </Text>
            </TouchableOpacity>
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
      {sendError && sendErrorAction ? (
        <TouchableOpacity
          accessibilityRole="button"
          testID="send-error-action"
          onPress={sendErrorAction.onPress}
          disabled={disabled}
        >
          <Text style={styles.sendErrorAction}>{sendErrorAction.label}</Text>
        </TouchableOpacity>
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

  const canCancelUpload = isUploading && onCancelUpload != null
  const attachLabel = canCancelUpload ? tCommon('button.cancel') : t('input.attachLabel')
  const attachButton = (
    <TouchableOpacity
      testID="chat-attach-button"
      style={[styles.iconBtn, ((isUploading && !canCancelUpload) || disabled) && styles.disabled]}
      onPress={canCancelUpload ? onCancelUpload : onAttach}
      disabled={(isUploading && !canCancelUpload) || disabled}
      accessibilityLabel={attachLabel}
      hitSlop={8}
    >
      {isUploading ? (
        <View style={styles.uploadSpinner}>
          <ActivityIndicator size="small" color={theme.text.primary} />
          {canCancelUpload ? (
            <View style={styles.uploadCancelBadge} testID="chat-attach-cancel">
              <X size={10} weight="bold" color={theme.text.primary} />
            </View>
          ) : null}
        </View>
      ) : (
        <Paperclip size={24} color={theme.text.primary} />
      )}
    </TouchableOpacity>
  )

  // Stop outranks Send while listening: once the first words land `hasContent`
  // turns true, and without this the only way out of dictation would be to send
  // or wait for the silence timeout.
  const trailingButton = voice.listening ? (
    <TouchableOpacity
      testID="chat-mic-button"
      style={styles.sendBtn}
      hitSlop={10}
      onPress={onToggleMic}
      accessibilityLabel={t('voice.stop')}
    >
      <MicrophoneSlash size={24} color={theme.text.onAccent} />
    </TouchableOpacity>
  ) : hasContent ? (
    <TouchableOpacity
      testID="chat-send-button"
      style={[styles.sendBtn, (disabled || sendDisabled) && styles.disabled]}
      hitSlop={10}
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
      hitSlop={10}
      onPress={onToggleMic}
      disabled={disabled}
      accessibilityLabel={t('voice.start')}
    >
      <Microphone size={24} color={theme.text.onAccent} />
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      testID="chat-send-button"
      style={[styles.sendBtn, styles.disabled]}
      hitSlop={10}
      disabled
      accessibilityLabel={t('action.sendInput')}
    >
      <PaperPlaneRight size={24} color={theme.text.onAccent} />
    </TouchableOpacity>
  )

  return (
    <Reanimated.View style={[styles.inputArea, inputAreaPadding]} testID="composer-input-area">
      {errors}
      {quoteChip}
      {chips}
      {suggestionChip}
      {expanded ? null : mentionBoard}
      <View style={styles.inputRow}>
        {attachButton}
        {Platform.OS === 'android' ? (
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              testID="chat-message-input"
              style={[styles.input, (disabled || value.length === 0) && styles.inputEmpty, grownHeight !== undefined && { height: grownHeight }, inputDirection, disabled && styles.disabled]}
              onContentSizeChange={(e) => setContentHeight(e.nativeEvent.contentSize.height)}
              value={inputValue}
              onChangeText={disabled ? undefined : onChangeText}
              onFocus={() => onInputFocus('inline')}
              selection={selection}
              onSelectionChange={onSelectionChange}
              onBlur={onInputBlur}
              placeholder={disabled ? t('status.starting') : placeholder ?? t('input.placeholder')}
              placeholderTextColor={theme.text.secondary}
              multiline
              scrollEnabled
              textAlignVertical="top"
              editable={!disabled && !voice.listening}
            >
              {inputChildren}
            </TextInput>
            {skillMeasure}
            {skillClear('skill-chip-clear')}
            <TouchableOpacity
              testID="expand-input-button"
              accessibilityRole="button"
              accessibilityLabel={t('input.expandLabel')}
              style={styles.expandBtnAndroid}
              onPress={() => { onExpand(); setExpanded(true) }}
              disabled={disabled}
              hitSlop={8}
            >
              <ArrowsOut size={18} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              testID="chat-message-input"
              style={[styles.input, (disabled || value.length === 0) && styles.inputEmpty, grownHeight !== undefined && { height: grownHeight }, inputDirection, disabled && styles.disabled]}
              onContentSizeChange={(e) => setContentHeight(e.nativeEvent.contentSize.height)}
              value={inputValue}
              onChangeText={disabled ? undefined : onChangeText}
              onFocus={() => onInputFocus('inline')}
              selection={selection}
              onSelectionChange={onSelectionChange}
              onBlur={onInputBlur}
              onKeyPress={onWebKeyPress}
              placeholder={disabled ? t('status.starting') : placeholder ?? t('input.placeholder')}
              placeholderTextColor={theme.text.secondary}
              multiline
              scrollEnabled
              textAlignVertical="top"
              editable={!disabled && !voice.listening}
            >
              {inputChildren}
            </TextInput>
            {skillMeasure}
            {skillClear('skill-chip-clear')}
            </View>
            <TouchableOpacity
              testID="expand-input-button"
              accessibilityRole="button"
              accessibilityLabel={t('input.expandLabel')}
              style={styles.expandBtn}
              onPress={() => { onExpand(); setExpanded(true) }}
              disabled={disabled}
              hitSlop={8}
            >
              <ArrowsOut size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </>
        )}
        {trailingButton}
      </View>
      {accessory}

      <Modal
        testID="expanded-composer-modal"
        visible={expanded}
        animationType="slide"
        onRequestClose={() => setExpanded(false)}
        onDismiss={minimizeIfPending}
      >
        {/* Same lift as the surfaces: the modal spans to the screen's bottom edge,
            so the keyboard height is exactly the padding it needs. RN's
            KeyboardAvoidingView measured its own frame and had no metrics when it
            mounted under an already-open keyboard — which is how it mounts here,
            since the editor opens from a focused composer. */}
        <Reanimated.View
          style={[styles.modalContainer, directionStyle, expandedKeyboardInset]}
          testID="expanded-composer-container"
        >
          {/* Same Modal trap as AttachmentPreview: a native SafeAreaView inside a
              Modal reports a zero top inset on iOS, so chips sat under the notch
              when the editor opened with the keyboard already up. */}
          <View
            style={[styles.flex, { paddingTop: insets.top }]}
            testID="expanded-composer-safe-top"
          >
            <Reanimated.View
              style={[styles.inputArea, styles.inputAreaExpanded, expandedInputAreaPadding]}
              testID="composer-input-area-expanded"
            >
              {errors}
              {quoteChip}
              {chips}
              {mentionBoard}
              <View style={styles.flex}>
              <TextInput
                ref={expandedInputRef}
                testID="message-input-expanded"
                style={[styles.inputExpandedField, inputDirection, disabled && styles.disabled]}
                value={inputValue}
                onChangeText={disabled ? undefined : onChangeText}
                onFocus={() => onInputFocus('expanded')}
                selection={selection}
                onSelectionChange={onSelectionChange}
                onBlur={() => {
                  // Closing the editor takes its input's focus with it (iOS blurs it before
                  // onDismiss). That is not the user putting the keyboard away, so it must
                  // not erase that the editor had focus before minimize is asked.
                  if (minimizeOnCloseRef.current) return
                  onInputBlur()
                }}
                placeholder={disabled ? t('status.starting') : placeholder ?? t('input.placeholder')}
                placeholderTextColor={theme.text.secondary}
                multiline
                textAlignVertical="top"
                autoFocus
                editable={!disabled && !voice.listening}
              >
                {inputChildren}
              </TextInput>
              {skillClear('skill-chip-clear-expanded')}
              </View>
              <View style={styles.expandedToolbar}>
                <TouchableOpacity
                  testID="minimize-input-button"
                  style={styles.iconBtn}
                  onPress={() => {
                    minimizeOnCloseRef.current = true
                    setExpanded(false)
                  }}
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
                  testID="expanded-send-button"
                  style={[styles.sendBtn, (!hasContent || disabled || sendDisabled) && styles.disabled]}
                  hitSlop={10}
                  onPress={() => {
                    handleSend()
                    minimizeOnCloseRef.current = true
                    setExpanded(false)
                  }}
                  disabled={!hasContent || disabled || sendDisabled}
                  accessibilityLabel={t('action.sendInput')}
                >
                  <PaperPlaneRight size={26} color={theme.text.onAccent} />
                </TouchableOpacity>
              </View>
            </Reanimated.View>
          </View>
        </Reanimated.View>
        {expanded ? preview : null}
      </Modal>
      {expanded ? null : preview}
    </Reanimated.View>
  )
}

function makeStyles(theme: Theme) {
  // WhatsApp-style chrome: iOS keeps send/mic on the physical right; Android
  // inherits RTL so they sit on the left. TextInput still uses `inputDirection`.
  const iosComposerChrome = Platform.OS === 'ios' ? layoutDirectionStyle('ltr') : {}

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
    sendErrorAction: { color: theme.text.accent, fontSize: font.sm, textDecorationLine: 'underline' },
    sendNotice: { color: theme.text.secondary, fontSize: font.sm },
    inputRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, ...iosComposerChrome },
    // Not flex: 1 — inside the column inputWrapper that sets a zero flex-basis, which makes
    // React Native ignore the explicit height the auto-grow sets.
    input: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
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
    // Pin the empty height: native multiline sizing can retain the sent draft's height.
    inputEmpty: { height: 44 },
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
    skillName: { color: theme.text.accent, fontWeight: '600' },
    // Same font as the input, so its width is the name's width in the input.
    skillMeasure: { position: 'absolute', opacity: 0, fontSize: font.base, fontWeight: '600' },
    skillClear: {
      position: 'absolute',
      top: -4,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.text.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    expandBtnAndroid: { position: 'absolute', top: 4, end: 4 },
    expandedToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingTop: spacing.xs,
      ...iosComposerChrome,
    },
    uploadSpinner: {
      width: 28,
      height: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    uploadCancelBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.bg.primary,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
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
      width: 56,
      backgroundColor: theme.text.accent,
      borderRadius: 10,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // A horizontal ScrollView defaults to flexGrow: 1, so in the expanded editor's flex column it
    // split the height with the text field and stretched every chip to fill its half.
    chipsScroll: { flexGrow: 0, flexShrink: 0 },
    chipsRow: { flexDirection: 'row', ...layoutDirectionStyle('ltr'), gap: spacing.xs, paddingVertical: spacing.xs },
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
    quoteChip: { maxWidth: '30%', alignSelf: 'flex-start', marginTop: spacing.xs },
    chipBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
    chipText: { color: theme.text.primary, fontSize: font.xs, flexShrink: 1 },
    suggestionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: theme.bg.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      maxWidth: '100%',
    },
    suggestionText: { color: theme.text.secondary, fontSize: font.sm, flexShrink: 1 },
    disabled: { opacity: 0.4 },
  })
}

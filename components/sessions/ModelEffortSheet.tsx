import React, { useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { EFFORT_LEVELS, MODEL_ALIASES, MODEL_NAME_RE } from '@/constants/models'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { textDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'
import { isRouteMissingError, isUnsupportedProviderError } from '@/lib/modelEffortSupport'
import { NetworkError } from '@/services/api-client'

interface Props {
  visible: boolean
  /** Scraped display string from the status line — shown, never preselected. */
  model?: string
  effort?: string
  /** The session has a turn in flight; the streamer answers 409 SESSION_BUSY. */
  busy?: boolean
  isPending?: boolean
  error?: Error | null
  onApply: (values: { model?: string; effort?: string }) => void
  onClose: () => void
}

export function ModelEffortSheet({
  visible,
  model,
  effort,
  busy = false,
  isPending = false,
  error = null,
  onApply,
  onClose,
}: Props) {
  const { t } = useTranslation(['terminal', 'common'])
  const theme = useTheme()
  const styles = makeStyles(theme)
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const copyStyle = textDirectionStyle(direction)

  // Drafts live for one opening: the parent mounts the sheet only while it is
  // open, so closing it discards them without a reset effect.
  const [modelDraft, setModelDraft] = useState('')
  const [effortDraft, setEffortDraft] = useState<string | null>(null)

  const trimmedModel = modelDraft.trim()
  const modelInvalid = trimmedModel !== '' && !MODEL_NAME_RE.test(trimmedModel)
  const nextEffort = effortDraft !== null && effortDraft !== effort ? effortDraft : undefined
  const nextModel = trimmedModel !== '' && !modelInvalid ? trimmedModel : undefined
  const canApply = !busy && !isPending && (nextModel !== undefined || nextEffort !== undefined)

  // Mapped inline rather than in a helper so `t` keeps its namespace-typed
  // signature and every key stays statically visible to the i18n analyzer.
  let errorMessage: string | null = null
  if (error) {
    if (isRouteMissingError(error) || isUnsupportedProviderError(error)) {
      errorMessage = t('session.modelEffortUnsupported')
    } else if (error instanceof NetworkError && error.status === 409) {
      errorMessage = error.code === 'SESSION_IDLE'
        ? t('session.modelEffortIdle')
        : t('session.modelEffortBusy')
    } else {
      errorMessage = t('session.modelEffortFailed')
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.overlay, directionStyle]}>
        <View style={styles.card} testID="session-model-effort-sheet">
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, copyStyle]}>{t('session.modelEffort')}</Text>
            <Text style={[styles.subtitle, copyStyle]}>{t('session.modelEffortSubtitle')}</Text>

            <Text style={[styles.label, copyStyle]}>{t('session.modelLabel')}</Text>
            {model ? (
              <Text style={[styles.current, copyStyle]} testID="session-model-current">
                {t('session.modelCurrent', { model })}
              </Text>
            ) : null}
            <TextInput
              style={[styles.input, copyStyle]}
              value={modelDraft}
              onChangeText={setModelDraft}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('session.modelPlaceholder')}
              placeholderTextColor={theme.text.secondary}
              testID="session-model-input"
            />
            <View style={[styles.chipRow, { direction: 'ltr' }]}>
              {MODEL_ALIASES.map((alias) => (
                <TouchableOpacity
                  key={alias}
                  style={[styles.chip, trimmedModel === alias && styles.chipActive]}
                  onPress={() => setModelDraft(alias)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: trimmedModel === alias }}
                  testID={`session-model-alias-${alias}`}
                >
                  <Text style={[styles.chipText, trimmedModel === alias && styles.chipTextActive]}>
                    {alias}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {modelInvalid ? (
              <Text style={[styles.error, copyStyle]} testID="session-model-invalid">
                {t('session.modelInvalid')}
              </Text>
            ) : null}

            <Text style={[styles.label, copyStyle]}>{t('session.effortLabel')}</Text>
            {effort ? (
              <Text style={[styles.current, copyStyle]} testID="session-effort-current">
                {t('session.effortCurrent', { effort })}
              </Text>
            ) : null}
            <View style={[styles.chipRow, { direction: 'ltr' }]}>
              {EFFORT_LEVELS.map((level) => {
                const selected = (effortDraft ?? effort) === level
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => setEffortDraft(level)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`session-effort-${level}`}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{level}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {busy ? (
              <Text style={[styles.notice, copyStyle]} testID="session-model-effort-busy">
                {t('session.modelEffortBusy')}
              </Text>
            ) : null}
            {errorMessage ? (
              <Text style={[styles.error, copyStyle]} testID="session-model-effort-error">
                {errorMessage}
              </Text>
            ) : null}

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.75}>
                <Text style={[styles.cancelLabel, copyStyle]}>{t('common:button.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyButton, !canApply && styles.applyButtonDisabled]}
                onPress={() => onApply({ model: nextModel, effort: nextEffort })}
                disabled={!canApply}
                activeOpacity={0.75}
                testID="session-model-effort-apply"
              >
                <Text style={[styles.applyLabel, copyStyle]}>{t('session.modelEffortApply')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
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
      maxHeight: '80%',
      backgroundColor: theme.bg.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    content: {
      padding: spacing.xl,
      gap: spacing.sm,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '600',
    },
    subtitle: {
      color: theme.text.secondary,
      fontSize: font.sm,
    },
    label: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      marginTop: spacing.md,
    },
    current: {
      color: theme.text.secondary,
      fontSize: font.sm,
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
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      borderColor: theme.text.accent,
      backgroundColor: theme.bg.secondary,
    },
    chipText: {
      color: theme.text.secondary,
      fontSize: font.sm,
    },
    chipTextActive: {
      color: theme.text.accent,
      fontWeight: '600',
    },
    notice: {
      color: theme.text.secondary,
      fontSize: font.sm,
    },
    error: {
      color: theme.text.danger,
      fontSize: font.sm,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
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
    applyButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.text.accent,
      alignItems: 'center',
    },
    applyButtonDisabled: {
      opacity: 0.5,
    },
    applyLabel: {
      color: theme.text.onAccent,
      fontSize: font.base,
      fontWeight: '600',
    },
  })
}

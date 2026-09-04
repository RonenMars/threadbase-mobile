import React, { useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CircleIcon, RadioButtonIcon, SquareIcon, CheckSquareIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { AppliedSessionLeaveAction } from '@/lib/sessionLeavePolicy'
import { DEFAULT_LEAVE_MODAL_CHOICE } from '@/lib/sessionLeavePolicy'
import type { SessionLeavePhase } from '@/hooks/useSessionLeaveGuard'
import { blockTextDirectionStyle, textDirectionStyle, useAppDirection, useDirectionStyle } from '@/lib/rtl'

const OPTIONS: AppliedSessionLeaveAction[] = ['kill', 'leave', 'kill_on_idle']

function getLeaveActionTitle(
  action: AppliedSessionLeaveAction,
  t: TFunction<['terminal', 'common']>,
): string {
  switch (action) {
    case 'kill':
      return t('terminal:leaveSession.kill')
    case 'leave':
      return t('terminal:leaveSession.leave')
    case 'kill_on_idle':
      return t('terminal:leaveSession.kill_on_idle')
  }
}

function getLeaveActionHint(
  action: AppliedSessionLeaveAction,
  t: TFunction<['terminal', 'common']>,
): string {
  switch (action) {
    case 'kill':
      return t('terminal:leaveSession.killHint')
    case 'leave':
      return t('terminal:leaveSession.leaveHint')
    case 'kill_on_idle':
      return t('terminal:leaveSession.kill_on_idleHint')
  }
}

interface Props {
  visible: boolean
  phase: SessionLeavePhase
  onCancel: () => void
  onConfirm: (choice: AppliedSessionLeaveAction, remember: boolean) => void
  onDismissError: () => void
  // iOS-only native signal (RN never calls this on Android) that the modal's
  // close animation has actually finished — see useSessionLeaveGuard's
  // finishLeave for why the guard waits on it before navigating.
  onModalDismiss: () => void
}

export function LeaveSessionModal({
  visible,
  phase,
  onCancel,
  onConfirm,
  onDismissError,
  onModalDismiss,
}: Props) {
  const showOptions = visible && phase === 'idle'
  const showPending = phase === 'pending'
  const showError = phase === 'error'
  return (
    <Modal
      visible={showOptions || showPending || showError}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
      onDismiss={onModalDismiss}
    >
      {showOptions ? <LeaveSessionForm onCancel={onCancel} onConfirm={onConfirm} /> : null}
      {showPending ? <LeaveSessionStatusCard kind="pending" /> : null}
      {showError ? <LeaveSessionStatusCard kind="error" onDismiss={onDismissError} /> : null}
    </Modal>
  )
}

function LeaveSessionStatusCard({
  kind,
  onDismiss,
}: {
  kind: 'pending' | 'error'
  onDismiss?: () => void
}) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const copyStyle = blockTextDirectionStyle(direction)
  const optionTextStyle = textDirectionStyle(direction)
  const { t } = useTranslation(['terminal', 'common'])

  return (
    <View style={[styles.overlay, directionStyle]}>
      <View
        style={styles.card}
        accessibilityRole="alert"
        accessibilityViewIsModal
        testID={kind === 'pending' ? 'leave-session-pending' : 'leave-session-error'}
      >
        {kind === 'pending' ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={theme.text.accent} />
            <Text style={[styles.body, copyStyle]}>{t('terminal:leaveSession.pending')}</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.body, copyStyle]}>{t('terminal:leaveSession.error')}</Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={onDismiss}
              testID="leave-session-error-ok"
              accessibilityRole="button"
              accessibilityLabel={t('common:button.confirm')}
            >
              <Text style={[styles.confirmLabel, optionTextStyle]}>{t('common:button.confirm')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}

function LeaveSessionForm({
  onCancel,
  onConfirm,
}: Pick<Props, 'onCancel' | 'onConfirm'>) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const directionStyle = useDirectionStyle()
  const { direction } = useAppDirection()
  const copyStyle = blockTextDirectionStyle(direction)
  const optionTextStyle = textDirectionStyle(direction)
  const { t } = useTranslation(['terminal', 'common'])
  const [choice, setChoice] = useState<AppliedSessionLeaveAction>(DEFAULT_LEAVE_MODAL_CHOICE)
  const [remember, setRemember] = useState(false)

  return (
      <View style={[styles.overlay, directionStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityLabel={t('common:button.cancel')}
        />
        <View
          style={styles.card}
          accessibilityRole="alert"
          accessibilityViewIsModal
          testID="leave-session-modal"
        >
          <Text style={[styles.title, copyStyle]}>{t('terminal:leaveSession.title')}</Text>
          <Text style={[styles.body, copyStyle]}>{t('terminal:leaveSession.body')}</Text>

          <View accessibilityRole="radiogroup" style={styles.options}>
            {OPTIONS.map((id) => {
              const selected = choice === id
              return (
                <TouchableOpacity
                  key={id}
                  style={styles.option}
                  onPress={() => setChoice(id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  testID={`leave-session-option-${id}`}
                >
                  {selected ? (
                    <RadioButtonIcon size={22} color={theme.text.accent} weight="fill" />
                  ) : (
                    <CircleIcon size={22} color={theme.text.secondary} />
                  )}
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, optionTextStyle]}>{getLeaveActionTitle(id, t)}</Text>
                    <Text style={[styles.optionHint, optionTextStyle]}>{getLeaveActionHint(id, t)}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRemember((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            testID="leave-session-remember"
          >
            {remember ? (
              <CheckSquareIcon size={22} color={theme.text.accent} weight="fill" />
            ) : (
              <SquareIcon size={22} color={theme.text.secondary} />
            )}
            <Text style={[styles.rememberLabel, optionTextStyle]}>{t('terminal:leaveSession.remember')}</Text>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              testID="leave-session-cancel"
              accessibilityRole="button"
              accessibilityLabel={t('common:button.cancel')}
            >
              <Text style={[styles.cancelLabel, optionTextStyle]}>{t('common:button.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => onConfirm(choice, remember)}
              testID="leave-session-confirm"
              accessibilityRole="button"
              accessibilityLabel={t('common:button.confirm')}
            >
              <Text style={[styles.confirmLabel, optionTextStyle]}>{t('common:button.confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    body: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 20,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    options: {
      gap: spacing.sm,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      minHeight: 44,
    },
    optionCopy: {
      flex: 1,
      gap: 2,
    },
    optionTitle: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    optionHint: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 18,
    },
    rememberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
    },
    rememberLabel: {
      color: theme.text.primary,
      fontSize: font.sm,
      flex: 1,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    cancelButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelLabel: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
    },
    confirmButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      backgroundColor: theme.text.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmLabel: {
      color: theme.text.onAccent,
      fontSize: font.base,
      fontWeight: '700',
    },
  })
}

import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { CircleIcon, RadioButtonIcon, SquareIcon, CheckSquareIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { CriticalDialog, type CriticalAction } from '@/components/alerts/CriticalDialog'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { AppliedSessionLeaveAction } from '@/lib/sessionLeavePolicy'
import { DEFAULT_LEAVE_MODAL_CHOICE } from '@/lib/sessionLeavePolicy'
import type { SessionLeavePhase } from '@/hooks/useSessionLeaveGuard'
import { textDirectionStyle, useAppDirection } from '@/lib/rtl'

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
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { direction } = useAppDirection()
  const optionTextStyle = textDirectionStyle(direction)
  const { t } = useTranslation(['terminal', 'common'])
  const showOptions = visible && phase === 'idle'
  const showPending = phase === 'pending'
  const showError = phase === 'error'
  const open = showOptions || showPending || showError
  const [choice, setChoice] = useState<AppliedSessionLeaveAction>(DEFAULT_LEAVE_MODAL_CHOICE)
  const [remember, setRemember] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setChoice(DEFAULT_LEAVE_MODAL_CHOICE)
      setRemember(false)
    }
  }

  const message = showPending
    ? t('terminal:leaveSession.pending')
    : showError
      ? t('terminal:leaveSession.error')
      : t('terminal:leaveSession.body')

  const testID = showPending
    ? 'leave-session-pending'
    : showError
      ? 'leave-session-error'
      : 'leave-session-modal'

  const actions: CriticalAction[] = showError
    ? [{
        label: t('common:button.confirm'),
        onPress: onDismissError,
        testID: 'leave-session-error-ok',
      }]
    : showOptions
      ? [
          {
            label: t('common:button.cancel'),
            onPress: onCancel,
            variant: 'secondary',
            testID: 'leave-session-cancel',
          },
          {
            label: t('common:button.confirm'),
            onPress: () => onConfirm(choice, remember),
            testID: 'leave-session-confirm',
          },
        ]
      : []

  return (
    <CriticalDialog
      visible={open}
      title={t('terminal:leaveSession.title')}
      message={message}
      level="warning"
      busy={showPending}
      dismissable={!showPending}
      onRequestClose={showError ? onDismissError : onCancel}
      onDismiss={onModalDismiss}
      testID={testID}
      actions={actions}
    >
      {showOptions ? (
        <>
          <View accessibilityRole="radiogroup" style={styles.options}>
            {OPTIONS.map((id) => {
              const checked = choice === id
              return (
                <TouchableOpacity
                  key={id}
                  style={styles.option}
                  onPress={() => setChoice(id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked }}
                  testID={`leave-session-option-${id}`}
                >
                  {checked ? (
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
        </>
      ) : null}
    </CriticalDialog>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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
  })
}

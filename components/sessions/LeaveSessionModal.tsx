import React, { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { SquareIcon, CheckSquareIcon } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { CriticalDialog, type CriticalAction } from '@/components/alerts/CriticalDialog'
import { font, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { AppliedSessionLeaveAction } from '@/lib/sessionLeavePolicy'
import type { SessionLeavePhase } from '@/hooks/useSessionLeaveGuard'
import { textDirectionStyle, useAppDirection } from '@/lib/rtl'

interface Props {
  visible: boolean
  phase: SessionLeavePhase
  /** Display name of the agent, e.g. "Claude". */
  agent: string
  /** Display name of the server the session runs on. */
  server: string
  /** False while the session waits for input: there is no turn left to finish. */
  offerWhenDone: boolean
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
  agent,
  server,
  offerWhenDone,
  onCancel,
  onConfirm,
  onDismissError,
  onModalDismiss,
}: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { direction } = useAppDirection()
  const labelStyle = textDirectionStyle(direction)
  const { t } = useTranslation(['terminal', 'common'])
  const showOptions = visible && phase === 'idle'
  const showPending = phase === 'pending'
  const showError = phase === 'error'
  const open = showOptions || showPending || showError
  const [remember, setRemember] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setRemember(false)
  }

  const message = showPending
    ? t('terminal:leaveSession.pending')
    : showError
      ? t('terminal:leaveSession.error')
      : t('terminal:leaveSession.body', { agent, server })

  const testID = showPending
    ? 'leave-session-pending'
    : showError
      ? 'leave-session-error'
      : 'leave-session-modal'

  const whenDone: CriticalAction[] = offerWhenDone
    ? [{
        label: t('terminal:leaveSession.kill_on_idle'),
        onPress: () => onConfirm('kill_on_idle', remember),
        variant: 'secondary',
        testID: 'leave-session-option-kill_on_idle',
      }]
    : []

  const actions: CriticalAction[] = showError
    ? [{
        label: t('common:button.confirm'),
        onPress: onDismissError,
        testID: 'leave-session-error-ok',
      }]
    : showOptions
      ? [
          {
            label: t('terminal:leaveSession.leave'),
            onPress: () => onConfirm('leave', remember),
            testID: 'leave-session-option-leave',
          },
          ...whenDone,
          {
            label: t('terminal:leaveSession.kill'),
            onPress: () => onConfirm('kill', remember),
            variant: 'destructive',
            testID: 'leave-session-option-kill',
          },
          {
            label: t('terminal:leaveSession.stay'),
            onPress: onCancel,
            variant: 'secondary',
            testID: 'leave-session-cancel',
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
      stacked
    >
      {showOptions ? (
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
          <Text style={[styles.rememberLabel, labelStyle]}>{t('terminal:leaveSession.remember')}</Text>
        </TouchableOpacity>
      ) : null}
    </CriticalDialog>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
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

import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { CriticalDialog } from '@/components/alerts/CriticalDialog'
import { font, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { blockTextDirectionStyle, useAppDirection } from '@/lib/rtl'

interface Props {
  visible: boolean
  /** Display name of the server the session runs on. */
  server: string
  /** A turn is in flight, so stopping cuts it. */
  running: boolean
  /** App the server can open on the tmux session; adds a second confirm button. */
  terminalName?: string
  onConfirm: () => void
  onConfirmOpen: () => void
  onDismiss: () => void
}

export function HandoffDialog({ visible, server, running, terminalName, onConfirm, onConfirmOpen, onDismiss }: Props) {
  const { t } = useTranslation(['sessions', 'common'])
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { direction } = useAppDirection()

  return (
    <CriticalDialog
      visible={visible}
      level="warning"
      title={t('handoff.title')}
      message={t('handoff.body', { server })}
      onRequestClose={onDismiss}
      testID="session-handoff-dialog"
      actions={[
        { label: t('common:button.cancel'), variant: 'secondary', onPress: onDismiss, testID: 'session-handoff-cancel' },
        { label: t('handoff.confirm'), onPress: onConfirm, testID: 'session-handoff-confirm' },
        ...(terminalName
          ? [{ label: t('handoff.confirmOpen', { terminal: terminalName }), onPress: onConfirmOpen, testID: 'session-handoff-confirm-open' }]
          : []),
      ]}
      stacked={terminalName !== undefined}
    >
      {running ? (
        <Text style={[styles.interrupt, blockTextDirectionStyle(direction)]} testID="session-handoff-interrupt">
          {t('handoff.interruptWarning')}
        </Text>
      ) : null}
    </CriticalDialog>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    interrupt: { color: theme.text.secondary, fontSize: font.sm },
  })
}

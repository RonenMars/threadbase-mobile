import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ClockCounterClockwise } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { CriticalDialog } from '@/components/alerts/CriticalDialog'
import { getProviderLabel } from '@/components/sessions/providerLabel'
import { providerLabelKey } from '@/constants/providers'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { EndSessionDialog } from '@/hooks/useEndSession'
import { blockTextDirectionStyle, useAppDirection } from '@/lib/rtl'

interface Props {
  dialog: EndSessionDialog
  provider: string | null | undefined
  /** Display name of the server the session runs on. */
  server: string
  onConfirmDelete: () => void
  onConfirmWatchers: () => void
  onDismiss: () => void
}

function getKeepsLine(provider: string | null | undefined, server: string, t: TFunction<'sessions'>): string {
  switch (providerLabelKey(provider)) {
    case 'claude':
      return t('deleteDialog.keepsClaude', { server })
    case 'codex':
      return t('deleteDialog.keepsCodex', { server })
    case 'cursor':
      return t('deleteDialog.keepsCursor', { server })
  }
}

/** The two confirmations an end-session action can need: Delete, and arming while another device watches. */
export function EndSessionDialogs({ dialog, provider, server, onConfirmDelete, onConfirmWatchers, onDismiss }: Props) {
  const { t } = useTranslation(['sessions', 'common'])
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { direction } = useAppDirection()
  const copyStyle = blockTextDirectionStyle(direction)
  const agent = getProviderLabel(provider, t)

  return (
    <>
      <CriticalDialog
        visible={dialog === 'delete'}
        level="critical"
        title={t('deleteDialog.title')}
        message={t('deleteDialog.body')}
        onRequestClose={onDismiss}
        testID="end-session-delete-dialog"
        actions={[
          { label: t('common:button.cancel'), variant: 'secondary', onPress: onDismiss, testID: 'end-session-delete-cancel' },
          { label: t('deleteDialog.confirm'), variant: 'destructive', onPress: onConfirmDelete, testID: 'end-session-delete-confirm' },
        ]}
      >
        <View style={styles.keeps}>
          <ClockCounterClockwise size={18} color={theme.text.success} />
          <View style={styles.keepsCopy}>
            <Text style={[styles.keepsTitle, copyStyle]}>{t('deleteDialog.keepsTitle', { agent })}</Text>
            <Text style={[styles.keepsBody, copyStyle]}>{getKeepsLine(provider, server, t)}</Text>
          </View>
        </View>
        <Text style={[styles.noUndo, copyStyle]}>{t('deleteDialog.noUndo')}</Text>
      </CriticalDialog>
      <CriticalDialog
        visible={dialog === 'watchers'}
        level="warning"
        title={t('watchersDialog.title')}
        message={t('watchersDialog.body')}
        onRequestClose={onDismiss}
        testID="end-session-watchers-dialog"
        actions={[
          { label: t('common:button.cancel'), variant: 'secondary', onPress: onDismiss, testID: 'end-session-watchers-cancel' },
          { label: t('endSession.whenDone'), onPress: onConfirmWatchers, testID: 'end-session-watchers-confirm' },
        ]}
      />
    </>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    keeps: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.secondary,
    },
    keepsCopy: { flex: 1, gap: 2 },
    keepsTitle: { color: theme.text.primary, fontSize: font.sm, fontWeight: '600' },
    keepsBody: { color: theme.text.secondary, fontSize: font.sm, lineHeight: 19 },
    noUndo: { color: theme.text.secondary, fontSize: font.xs },
  })
}

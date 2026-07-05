import React from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { XCircle, X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { ServerConfig } from '@/types/api'

interface Props {
  visible: boolean
  server: ServerConfig | null
  onClose: () => void
}

function maskApiKey(key: string): string {
  if (key.length <= 4) return '••••'
  return '••••••••' + key.slice(-4)
}

export function ServerErrorModal({ visible, server, onClose }: Props) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation(['servers', 'common'])
  if (!server) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.dot, server.isConnected ? styles.dotConnected : styles.dotDisconnected]} />
              <Text style={styles.serverName}>{server.label || 'Server'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Server details */}
          <View style={styles.detailRows}>
            <DetailRow label="URL" value={server.url} mono />
            <DetailRow label="API Key" value={maskApiKey(server.apiKey)} mono />
            <DetailRow label="Machine" value={server.serverInfo?.machineName ?? '—'} />
            <DetailRow label="Platform" value={server.serverInfo?.platform ?? '—'} />
            <DetailRow label="Version" value={server.serverInfo ? `v${server.serverInfo.version}` : '—'} />
          </View>

          {/* Error box */}
          {server.connectionError ? (
            <ScrollView style={styles.errorBox} nestedScrollEnabled>
              <View style={styles.errorInner}>
                <XCircle size={14} color={theme.text.danger} weight="fill" style={styles.errorIcon} />
                <Text style={styles.errorText}>{server.connectionError}</Text>
              </View>
            </ScrollView>
          ) : null}

          {/* Close button */}
          <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose}>
            <Text style={styles.closeFooterText}>{t('common:button.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const theme = useTheme()
  const styles = makeStyles(theme)
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
    },
    modal: {
      width: '100%',
      // Opaque under glass — can stack over the Servers Status modal; a
      // translucent sheet over a translucent sheet bleeds text through.
      backgroundColor: theme.glass?.opaqueSurface ?? theme.bg.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dotConnected: { backgroundColor: theme.status.running },
    dotDisconnected: { backgroundColor: theme.status.failed },
    serverName: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      flex: 1,
    },
    closeBtn: {
      padding: spacing.xs,
    },
    detailRows: {
      padding: spacing.md,
      gap: spacing.xs,
    },
    detailRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
    },
    detailLabel: {
      color: theme.text.secondary,
      fontSize: font.base,
      width: 64,
    },
    detailValue: {
      color: theme.text.primary,
      fontSize: font.base,
      flex: 1,
    },
    mono: {
      fontFamily: 'monospace',
      fontSize: font.xs,
    },
    errorBox: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      maxHeight: 120,
      backgroundColor: 'rgba(248,81,73,0.08)',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(248,81,73,0.25)',
    },
    errorInner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      padding: spacing.sm,
    },
    errorIcon: {
      marginTop: 1,
    },
    errorText: {
      color: theme.text.danger,
      fontSize: font.xs,
      flex: 1,
      lineHeight: 18,
    },
    closeFooterBtn: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      padding: spacing.md,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    closeFooterText: {
      color: theme.text.accent,
      fontSize: font.base,
      fontWeight: '500',
    },
  })
}

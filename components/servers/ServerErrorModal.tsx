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
import { dark, font, radius, spacing } from '@/constants/theme'
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
  const { t } = useTranslation('servers')
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
              <X size={20} color={dark.text.secondary} />
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
                <XCircle size={14} color={dark.text.danger} weight="fill" style={styles.errorIcon} />
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
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.mono]} numberOfLines={1}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: dark.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: dark.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: dark.border,
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
  dotConnected: { backgroundColor: dark.status.running },
  dotDisconnected: { backgroundColor: dark.status.failed },
  serverName: {
    color: dark.text.primary,
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
    color: dark.text.secondary,
    fontSize: font.sm,
    width: 64,
  },
  detailValue: {
    color: dark.text.primary,
    fontSize: font.sm,
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
    color: dark.text.danger,
    fontSize: font.xs,
    flex: 1,
    lineHeight: 18,
  },
  closeFooterBtn: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: dark.border,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  closeFooterText: {
    color: dark.text.accent,
    fontSize: font.base,
    fontWeight: '500',
  },
})

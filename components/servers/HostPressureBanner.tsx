import React, { useCallback, useMemo, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { Warning } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useToastSync } from '@/hooks/useToastSync'
import { useServersStore } from '@/stores/servers'
import { GlassFill } from '@/components/ui/GlassFill'
import { parseHostPressureOs, type HostPressureLevel } from '@/types/api'
import type { AlertSpec } from '@/types/alerts'
import {
  hostPressureDetectedReasons,
  hostPressureServerName,
  hostPressureWhyFineReasons,
  primaryHostConstraint,
} from '@/utils/hostPressureCopy'
import { useDirectionStyle } from '@/lib/rtl'
import {
  getHostPressureBannerLabel,
  getHostPressureDetectedLabel,
  getHostPressureWhatToDoLabel,
  getHostPressureWhyFineLabel,
} from './hostPressureLabels'

const VIEWPORT = 'home'
const TOAST_ID = 'host-pressure'

export function HostPressureBanner() {
  const theme = useTheme()
  const directionStyle = useDirectionStyle()
  const styles = makeStyles(theme)
  const { t } = useTranslation('servers')
  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const hostPressure = useServersStore((s) => s.hostPressure)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dismissed, setDismissed] = useState<{
    serverId: string
    level: HostPressureLevel
  } | null>(null)

  const alertServerId = displayedServerIds.find((id) => hostPressure[id] != null)
  const pressure = alertServerId ? hostPressure[alertServerId] : null

  const handleDismiss = useCallback(() => {
    const state = useServersStore.getState()
    const serverId = state.displayedServerIds.find((id) => state.hostPressure[id] != null)
    const current = serverId ? state.hostPressure[serverId] : null
    if (serverId && current) setDismissed({ serverId, level: current.level })
    setSheetOpen(false)
  }, [])

  const hiddenForLevel = Boolean(
    pressure
    && alertServerId
    && dismissed?.serverId === alertServerId
    && dismissed.level === pressure.level,
  )
  const visible = Boolean(pressure && alertServerId) && !hiddenForLevel

  const server = alertServerId ? servers[alertServerId] : undefined
  const serverLabel = hostPressureServerName(server)
  const bannerText = pressure
    ? getHostPressureBannerLabel(
        pressure.level,
        primaryHostConstraint(pressure.reasons),
        serverLabel ?? '',
        t,
      )
    : ''
  const detailsLabel = t('action.details')
  const modalLead = t('hostPressure.modalLead')

  const spec = useMemo((): AlertSpec | null => {
    if (!visible) return null
    return {
      // Critical stays amber like elevated: the stronger wording carries the
      // level, turning it red would read as an app error.
      level: 'warning',
      title: bannerText,
      message: modalLead,
      timeout: null,
      hideCloseButton: true,
      onPress: () => setSheetOpen(true),
      onClose: handleDismiss,
      buttonText: detailsLabel,
      buttonAction: () => setSheetOpen(true),
      testID: 'host-pressure-banner',
    }
  }, [visible, bannerText, modalLead, detailsLabel, handleDismiss])

  useToastSync(TOAST_ID, spec, VIEWPORT)

  if (!sheetOpen || !pressure || !alertServerId || hiddenForLevel) return null

  const os = pressure.os ?? parseHostPressureOs(server?.serverInfo?.platform)
  const detectedLines = hostPressureDetectedReasons(pressure.reasons).map((reason) =>
    getHostPressureDetectedLabel(reason, t),
  )
  const whyFineLines = hostPressureWhyFineReasons(pressure.reasons).map((reason) =>
    getHostPressureWhyFineLabel(reason, t),
  )
  const showAgents = pressure.reasons.includes('agents')
  const agentsLine = showAgents
    ? t('hostPressure.detected.agents', { count: pressure.liveAgents })
    : ''
  const whatToDo = getHostPressureWhatToDoLabel(os, t)
  const accentColor = theme.status.waiting

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => setSheetOpen(false)}
      statusBarTranslucent
    >
      <Pressable style={[styles.backdrop, directionStyle]} onPress={() => setSheetOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => {}} testID="host-pressure-sheet">
          <GlassFill />
          <View style={styles.header}>
            <Warning size={20} color={accentColor} weight="regular" />
            <Text style={styles.sheetTitle}>{bannerText}</Text>
          </View>
          <Text style={styles.body}>{modalLead}</Text>
          {detectedLines.map((line) => (
            <Text key={line} style={styles.body}>{line}</Text>
          ))}
          {whyFineLines.map((line) => (
            <Text key={line} style={styles.body}>{line}</Text>
          ))}
          {showAgents ? (
            <Text style={styles.body}>{agentsLine}</Text>
          ) : null}
          <Text style={styles.body}>{whatToDo}</Text>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={handleDismiss}
            accessibilityRole="button"
            testID="host-pressure-dismiss"
          >
            <Text style={styles.dismissText}>{t('hostPressure.dismiss')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    sheet: {
      backgroundColor: theme.bg.secondary,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing.md,
      gap: spacing.sm,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    sheetTitle: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '600',
      lineHeight: 20,
    },
    body: {
      color: theme.text.secondary,
      fontSize: font.sm,
      lineHeight: 18,
    },
    dismissBtn: {
      alignSelf: 'flex-end',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    dismissText: {
      color: theme.text.accent,
      fontSize: font.sm,
      fontWeight: '600',
    },
  })
}

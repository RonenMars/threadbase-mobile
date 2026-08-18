import React, { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { WarningCircle } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useServersStore } from '@/stores/servers'
import { GlassFill } from '@/components/ui/GlassFill'

export function HostPressureBanner() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const { t } = useTranslation('servers')
  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const hostPressure = useServersStore((s) => s.hostPressure)
  const [sheetOpen, setSheetOpen] = useState(false)

  const alertServerId = displayedServerIds.find((id) => hostPressure[id] != null)
  const pressure = alertServerId ? hostPressure[alertServerId] : null

  if (!pressure || !alertServerId) return null

  const serverLabel = servers[alertServerId]?.label || servers[alertServerId]?.url || alertServerId
  const bannerText = pressure.level === 'critical'
    ? t('hostPressure.bannerCritical', { server: serverLabel, count: pressure.liveAgents })
    : t('hostPressure.bannerElevated', { server: serverLabel, count: pressure.liveAgents })
  const iconColor = pressure.level === 'critical' ? theme.status.failed : theme.status.waiting
  const sheetBody = t('hostPressure.sheetBody', {
    server: serverLabel,
    count: pressure.liveAgents,
  })
  const reasonLine = pressure.reasons
    .map((reason) => {
      switch (reason) {
        case 'memory':
          return t('hostPressure.reason.memory')
        case 'event_loop':
          return t('hostPressure.reason.event_loop')
        case 'load':
          return t('hostPressure.reason.load')
        case 'agents':
          return t('hostPressure.reason.agents')
      }
    })
    .join(', ')

  return (
    <>
      <TouchableOpacity
        style={styles.banner}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={bannerText}
        testID="host-pressure-banner"
      >
        <WarningCircle size={18} color={iconColor} weight="fill" />
        <Text style={styles.title} numberOfLines={2}>
          {bannerText}
        </Text>
      </TouchableOpacity>

      {sheetOpen ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setSheetOpen(false)}
          statusBarTranslucent
        >
          <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <GlassFill />
              <View style={styles.header}>
                <WarningCircle size={20} color={iconColor} weight="fill" />
                <Text style={styles.sheetTitle}>{sheetBody}</Text>
              </View>
              {reasonLine ? (
                <Text style={styles.reasonLine}>{reasonLine}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={() => setSheetOpen(false)}
                accessibilityRole="button"
              >
                <Text style={styles.dismissText}>{t('hostPressure.dismiss')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    title: {
      flex: 1,
      color: theme.text.primary,
      fontSize: font.sm,
      lineHeight: 18,
    },
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
    reasonLine: {
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

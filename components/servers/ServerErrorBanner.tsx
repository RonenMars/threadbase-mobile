import React, { useState } from 'react'
import { StyleSheet, View, Text, Pressable } from 'react-native'
import { WarningCircle, CaretDown, CaretUp } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { type Theme, font, spacing } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useServersStore } from '@/stores/servers'
import { useServerFetchStatusStore } from '@/stores/serverFetchStatus'

function errorForServer(
  serverId: string,
  connectionError: string | null,
  fetchError: string | undefined,
): string | null {
  return connectionError ?? fetchError ?? null
}

/**
 * Inline banner shown when a displayed server is unreachable or returns an
 * error. Matches the size and design of ServerIndexingBanner. Includes an
 * expandable section showing the raw error detail.
 */
export function ServerErrorBanner() {
  const { t } = useTranslation('servers')
  const servers = useServersStore((s) => s.servers)
  const displayedServerIds = useServersStore((s) => s.displayedServerIds)
  const fetchStatuses = useServerFetchStatusStore((s) => s.statuses)

  const theme = useTheme()
  const styles = makeStyles(theme)

  const [expanded, setExpanded] = useState(false)

  // Collect first displayed server that is disconnected AND has an error message.
  const errorEntry = displayedServerIds
    .map((id) => {
      const server = servers[id]
      if (!server || server.isConnected) return null
      const msg = errorForServer(id, server.connectionError ?? null, fetchStatuses[id]?.error)
      if (!msg) return null
      return { label: server.label ?? server.url, error: msg }
    })
    .find(Boolean)

  if (!errorEntry) return null

  return (
    <View style={styles.banner} accessibilityRole="alert">
      {/* Header row */}
      <Pressable
        style={styles.headerRow}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? t('error.collapse') : t('error.expand')}
      >
        <View style={styles.iconAndText}>
          <WarningCircle size={16} color={theme.text.danger} weight="fill" />
          <View style={styles.textBlock}>
            <Text style={styles.title}>{t('error.label')}</Text>
            <Text style={styles.subtitle} numberOfLines={expanded ? undefined : 1}>
              {t('error.subtitle', { server: errorEntry.label })}
            </Text>
          </View>
        </View>
        {expanded
          ? <CaretUp size={14} color={theme.text.secondary} />
          : <CaretDown size={14} color={theme.text.secondary} />
        }
      </Pressable>

      {/* Expandable error detail */}
      {expanded && (
        <View style={styles.detail}>
          <Text style={styles.detailText} selectable>{errorEntry.error}</Text>
        </View>
      )}
    </View>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    banner: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.md,
      backgroundColor: theme.bg.secondary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      gap: spacing.xs,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    iconAndText: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
      flex: 1,
    },
    textBlock: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: theme.text.danger,
      fontSize: font.base,
      fontWeight: '600',
    },
    subtitle: {
      color: theme.text.secondary,
      fontSize: font.xs,
      lineHeight: 16,
    },
    detail: {
      backgroundColor: theme.bg.primary,
      borderRadius: 6,
      padding: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      marginTop: 2,
    },
    detailText: {
      color: theme.text.danger,
      fontSize: font.xs,
      fontFamily: 'monospace',
      lineHeight: 18,
    },
  })
}

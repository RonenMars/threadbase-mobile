import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useTranslation } from 'react-i18next'
import { CaretRight } from 'phosphor-react-native'
import type { ServerConfig } from '@/types/api'
import type { ServerFetchStatusEntry } from '@/stores/serverFetchStatus'
import { type Theme, font, radius, spacing } from '@/constants/theme'
import { useTheme, useIsGlass } from '@/contexts/ThemeContext'
import { useGlassSheetBackground } from '@/components/ui/GlassSheet'
import {
  blockTextDirectionStyle,
  ltrContentStyle,
  textDirectionStyle,
  useAppDirection,
  useDirectionStyle,
} from '@/lib/rtl'

interface Props {
  visible: boolean
  serverIds: string[]
  servers: Record<string, ServerConfig>
  fetchStatuses: Record<string, ServerFetchStatusEntry>
  onPick: (serverId: string) => void
  onClose: () => void
}

const SNAP_POINTS = ['40%', '70%']

// Without a backdrop the sheet has no outside area: a tap meant to dismiss it
// fell through to whatever sat behind. pressBehavior 'close' both swallows the
// tap and closes.
function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
}

export function NewSessionServerPicker({ visible, serverIds, servers, fetchStatuses, onPick, onClose }: Props) {
  const theme = useTheme()
  const isGlass = useIsGlass()
  const glassBackground = useGlassSheetBackground()
  const styles = makeStyles(theme)
  const { t } = useTranslation(['servers', 'common'])
  const { direction } = useAppDirection()
  const directionStyle = useDirectionStyle()
  const titleStyle = blockTextDirectionStyle(direction)
  const actionTextStyle = textDirectionStyle(direction)
  if (!visible) return null

  return (
    <BottomSheet
      snapPoints={SNAP_POINTS}
      index={0}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onClose={onClose}
      backgroundStyle={[styles.sheetBg, isGlass && styles.sheetBgGlass]}
      backgroundComponent={glassBackground}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={[styles.content, directionStyle]}>
        <Text style={[styles.title, titleStyle]}>{t('newSessionPicker.title')}</Text>
        <View style={styles.list}>
          {serverIds.map((id, index) => {
            const server = servers[id]
            if (!server) return null
            const unreachable =
              fetchStatuses[id]?.status === 'error' || Boolean(server.connectionError)
            return (
              <TouchableOpacity
                key={id}
                style={[styles.row, isGlass && styles.rowGlass]}
                onPress={() => onPick(id)}
                testID={`new-session-server-${index}`}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: unreachable ? theme.status.failed : theme.status.running },
                  ]}
                />
                <View style={styles.serverInfo}>
                  <Text style={[styles.serverLabel, ltrContentStyle]} numberOfLines={1}>
                    {server.label || server.url}
                  </Text>
                  {server.label ? (
                    <Text style={[styles.serverUrl, ltrContentStyle]} numberOfLines={1}>
                      {server.url}
                    </Text>
                  ) : null}
                  {unreachable ? (
                    <Text style={styles.serverUnreachable} testID={`new-session-server-unreachable-${index}`}>
                      {t('status.unreachable')}
                    </Text>
                  ) : null}
                </View>
                <CaretRight size={18} color={theme.text.secondary} />
              </TouchableOpacity>
            )
          })}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={[styles.cancelText, actionTextStyle]}>{t('common:button.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheet>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    sheetBg: { backgroundColor: theme.bg.secondary },
    sheetBgGlass: { backgroundColor: 'transparent' },
    handle: { backgroundColor: theme.border },
    content: { flex: 1, padding: spacing.md, gap: spacing.md },
    title: { color: theme.text.primary, fontSize: font.lg, fontWeight: '600' },
    list: { gap: spacing.sm },
    row: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg.card,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    rowGlass: { backgroundColor: 'transparent' },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    serverInfo: {
      flex: 1,
      gap: spacing.xs,
    },
    serverUnreachable: {
      color: theme.status.failed,
      fontSize: font.xs,
    },
    serverLabel: {
      color: theme.text.primary,
      fontSize: font.base,
      fontWeight: '500',
    },
    serverUrl: {
      color: theme.text.secondary,
      fontSize: font.xs,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: 'auto',
      paddingTop: spacing.sm,
    },
    cancelButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
    },
    cancelText: {
      color: theme.text.secondary,
      fontSize: font.base,
    },
  })
}

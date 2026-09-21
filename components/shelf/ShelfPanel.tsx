import React, { useMemo } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'phosphor-react-native'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/EmptyState'
import { GlassView } from '@/components/ui/GlassView'
import { ProviderMark } from '@/components/sessions/shared/ProviderMark'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import type { ShelfEntry } from '@/lib/savedShelf'
import { useDirectionStyle } from '@/lib/rtl'

interface Props {
  visible: boolean
  entries: ShelfEntry[]
  /** Server label per server id; shown only when more than one server is paired. */
  serverLabels: Record<string, string> | null
  reduceMotion: boolean
  onSelect: (entry: ShelfEntry) => void
  onClose: () => void
}

export function ShelfPanel({ visible, entries, serverLabels, reduceMotion, onSelect, onClose }: Props) {
  const { t } = useTranslation('shared')
  const theme = useTheme()
  const styles = useMemo(() => makeStyles(theme), [theme])
  const insets = useSafeAreaInsets()
  // Modal content is a separate native host, so the root direction must be re-applied here.
  const directionStyle = useDirectionStyle()

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.overlay, directionStyle, { paddingTop: insets.top + spacing.xl }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('shelf.close')} />
        <View style={styles.panel} testID="chat-shelf-panel" accessibilityViewIsModal>
          <GlassView style={StyleSheet.absoluteFill} intensity={60} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {t('shelf.title')}
            </Text>
            <Pressable
              testID="chat-shelf-close"
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('shelf.close')}
            >
              <X size={20} color={theme.text.secondary} />
            </Pressable>
          </View>
          {entries.length === 0 ? (
            <View testID="chat-shelf-empty">
              <EmptyState title={t('shelf.emptyTitle')} subtitle={t('shelf.emptySubtitle')} />
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {entries.map((entry) => (
                <ShelfRow
                  key={entry.favorite.id}
                  entry={entry}
                  serverLabel={serverLabels?.[entry.target.serverId]}
                  styles={styles}
                  onPress={() => onSelect(entry)}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

interface RowProps {
  entry: ShelfEntry
  serverLabel?: string
  styles: ReturnType<typeof makeStyles>
  onPress: () => void
}

function ShelfRow({ entry, serverLabel, styles, onPress }: RowProps) {
  const { t } = useTranslation('shared')
  const accessibilityLabel = entry.needsYou
    ? t('shelf.rowNeedsYou', { label: entry.favorite.label })
    : entry.favorite.label

  return (
    <Pressable
      testID={`chat-shelf-row-${entry.favorite.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {entry.provider ? <ProviderMark provider={entry.provider} /> : <View style={styles.markSpacer} />}
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {entry.favorite.label}
        </Text>
        {serverLabel ? (
          <Text style={styles.rowServer} numberOfLines={1}>
            {serverLabel}
          </Text>
        ) : null}
      </View>
      {entry.needsYou ? <View style={styles.needsYouDot} testID="chat-shelf-row-needs-you" /> : null}
    </Pressable>
  )
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    panel: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '70%',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.12)' : theme.border,
      overflow: 'hidden',
      // Android's blur fallback is only a tint, so the list needs a near-solid base to stay readable.
      backgroundColor: Platform.OS === 'android' ? `${theme.bg.secondary}f2` : undefined,
      paddingVertical: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    title: {
      color: theme.text.primary,
      fontSize: font.lg,
      fontWeight: '600',
    },
    list: {
      flexGrow: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    markSpacer: {
      width: 22,
    },
    rowText: {
      flex: 1,
    },
    rowLabel: {
      color: theme.text.primary,
      fontSize: font.base,
    },
    rowServer: {
      color: theme.text.secondary,
      fontSize: font.sm,
      marginTop: 2,
    },
    needsYouDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.status.waiting,
    },
  })

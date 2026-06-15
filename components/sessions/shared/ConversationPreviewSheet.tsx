import React, { useRef, useMemo, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native'
import BottomSheet from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { font, radius, spacing, type Theme } from '@/constants/theme'
import { useTheme } from '@/contexts/ThemeContext'
import { useConversation } from '@/hooks/useConversations'
import { useSettingsStore } from '@/stores/settings'
import { MessageBubble } from '@/components/conversation/MessageBubble'
import { ConversationListItem } from './ConversationListItem'

interface Props {
  /** Pass null/undefined to hide. The sheet opens when this is set. */
  target:
    | null
    | {
        kind: 'conversation' | 'session'
        id: string
        serverId: string
        title?: string | null
        path?: string | null
        timestamp?: string | number | Date | null
        branch?: string | null
        messageCount?: number
        live?: boolean
        serverLabel?: string | null
      }
  onClose: () => void
  onPin?: () => void
  isPinned?: boolean
}

const SNAP_POINTS = ['60%', '90%']

export function ConversationPreviewSheet({ target, onClose, onPin, isPinned }: Props) {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const styles = makeStyles(theme)
  const sheetRef = useRef<BottomSheet>(null)
  const router = useRouter()
  const messageCount = useSettingsStore((s) => s.rowPreviewModalCount)

  // Only fetch when we have a real conversation target.
  const enabled = target?.kind === 'conversation'
  const { data, isLoading } = useConversation(
    enabled ? target!.serverId : '',
    enabled ? target!.id : '',
  )

  useEffect(() => {
    if (target) sheetRef.current?.snapToIndex(0)
    else sheetRef.current?.close()
  }, [target])

  const messages = data?.messages
  const lastMessages = useMemo(() => {
    if (!messages) return []
    return messages.slice(-messageCount)
  }, [messages, messageCount])

  const handleOpen = useCallback(() => {
    if (!target) return
    const url = target.kind === 'session'
      ? `/session/${target.id}?server=${target.serverId}`
      : `/conversation/${target.id}?server=${target.serverId}`
    sheetRef.current?.close()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(url as any)
  }, [target, router])

  if (!target) return null

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: theme.bg.card }}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
    >
      <View style={styles.pinned}>
        <ConversationListItem
          testID={`preview-row-${target.kind}-${target.id ?? 'unknown'}`}
          title={target.title ?? undefined}
          path={target.path ?? undefined}
          timestamp={target.timestamp}
          branch={target.branch}
          messageCount={target.messageCount}
          live={target.live}
          serverLabel={target.serverLabel}
          density="compact"
          leading="dot"
          previewMode="none"
        />
      </View>

      <ScrollView contentContainerStyle={styles.messages}>
        {target.kind === 'session' ? (
          <Text style={styles.placeholder}>{t('preview.liveUnavailable')}</Text>
        ) : isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.text.secondary} />
          </View>
        ) : lastMessages.length === 0 ? (
          <Text style={styles.placeholder}>{t('preview.noMessages')}</Text>
        ) : (
          lastMessages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primary} onPress={handleOpen} activeOpacity={0.75}>
          <Text style={styles.primaryLabel}>
            {target.kind === 'session' ? t('preview.openSession') : t('preview.openConversation')}
          </Text>
        </TouchableOpacity>
        {onPin ? (
          <TouchableOpacity style={styles.ghost} onPress={onPin} activeOpacity={0.75}>
            <Text style={styles.ghostLabel}>{isPinned ? t('preview.unpin') : t('preview.pin')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </BottomSheet>
  )
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    pinned: {
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    messages: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    loading: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    placeholder: {
      color: theme.text.secondary,
      fontSize: font.sm,
      paddingVertical: spacing.md,
      textAlign: 'center',
    },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      paddingBottom: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.bg.card,
    },
    primary: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: theme.text.accent,
      alignItems: 'center',
    },
    primaryLabel: {
      color: theme.text.onAccent,
      fontWeight: '600',
      fontSize: font.base,
    },
    ghost: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    ghostLabel: {
      color: theme.text.primary,
      fontWeight: '500',
      fontSize: font.base,
    },
  })
}

import { useCallback, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ArrowSquareOut, CopySimple, HourglassMedium, Lightning, PencilSimple, Power, Star, Trash } from 'phosphor-react-native'
import { EndSessionDialogs } from '@/components/sessions/EndSessionDialogs'
import { NameSessionModal } from '@/components/sessions/NameSessionModal'
import { SessionActionSheet, type SessionActionItem } from '@/components/sessions/SessionActionSheet'
import { getSessionTierLabel } from '@/components/sessions/StateBadge'
import { getProviderLabel } from '@/components/sessions/providerLabel'
import type { SwipeAction } from '@/components/sessions/shared/SwipeableRow'
import { useTheme } from '@/contexts/ThemeContext'
import { conversationHref } from '@/lib/conversationHref'
import { isExternalSession } from '@/lib/externalSession'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { useEndSession } from '@/hooks/useEndSession'
import { useRenameSession } from '@/hooks/useSessionName'
import { useNavLockStore } from '@/stores/navLock'
import { buildFavoriteId, useQuickAccessStore } from '@/stores/quickAccess'
import type { MultiSession } from '@/types/api'

/** Mounted only while open, so a row carries no rename mutation until asked. */
function RenameSessionOverlay({ session, currentName, onClose }: {
  session: MultiSession
  currentName: string
  onClose: () => void
}) {
  const renameSession = useRenameSession(session.serverId)
  return (
    <NameSessionModal
      visible
      mode="rename"
      currentName={currentName}
      onSave={(name) => {
        renameSession.mutate({ sessionId: session.id, name })
        onClose()
      }}
      onCancel={onClose}
    />
  )
}

/**
 * Tap, long-press and ⋮ behaviour shared by every session row and card: an
 * external (observed) session opens the read-only conversation, a managed one
 * opens the PTY screen. Long-press and ⋮ open the action sheet on managed
 * sessions only; its End session group appears while the PTY is live.
 * `swipe` carries the same actions for a `SwipeableRow`.
 * Render `overlays` once next to the row.
 */
export function useSessionRowActions(session: MultiSession, title: string) {
  const router = useRouter()
  const { t } = useTranslation(['sessions', 'common'])
  const theme = useTheme()
  const isExternal = isExternalSession(session)
  const presentation = deriveSessionPresentation(session)
  const canEnd = presentation.live && presentation.capabilities.canCancel
  const end = useEndSession(session.serverId, session.id, canEnd)
  const [menuVisible, setMenuVisible] = useState(false)
  const [renameVisible, setRenameVisible] = useState(false)
  const favoriteId = buildFavoriteId(session.serverId, 'session', session.id)
  const isFavorite = useQuickAccessStore((s) => s.favorites.some((f) => f.id === favoriteId))

  const toggleFavorite = useCallback(() => {
    const { pinItem, unpinItem } = useQuickAccessStore.getState()
    if (isFavorite) {
      unpinItem(favoriteId)
      return
    }
    pinItem({ type: 'session', id: favoriteId, label: title, serverId: session.serverId, sessionId: session.id })
  }, [isFavorite, favoriteId, title, session.serverId, session.id])

  const open = useCallback(() => {
    useNavLockStore.getState().lock()
    if (isExternal) {
      const convId = session.boundConversationId ?? session.conversationId ?? session.id
      router.push(conversationHref(convId, session.serverId))
      return
    }
    router.push(`/session/${session.id}?server=${session.serverId}`)
  }, [session, isExternal, router])

  const handlePress = useCallback(() => {
    Haptics.selectionAsync()
    open()
  }, [open])

  const handleLongPress = () => {
    // External sessions are read-only — the managed actions never appear.
    if (isExternal) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setMenuVisible(true)
  }

  const handleMenuPress = () => setMenuVisible(true)

  const agent = getProviderLabel(session.provider, t)
  const server = session.serverLabel ?? ''
  const meta = [agent, getSessionTierLabel(presentation.tier, t), server].filter(Boolean).join(' · ')

  const items: SessionActionItem[] = [
    { key: 'open', label: t('endSession.open'), icon: ArrowSquareOut, onPress: open, testID: 'session-action-open' },
    {
      key: 'copy',
      label: t('card.copyId'),
      icon: CopySimple,
      onPress: () => void Clipboard.setStringAsync(session.id),
      testID: 'session-action-copy-id',
    },
    {
      key: 'rename',
      label: t('swipe.rename'),
      icon: PencilSimple,
      onPress: () => setRenameVisible(true),
      testID: 'session-action-rename',
    },
    {
      key: 'favorite',
      label: isFavorite ? t('common:favorite.remove') : t('common:favorite.add'),
      icon: Star,
      onPress: toggleFavorite,
      testID: 'session-action-favorite',
    },
  ]
  if (canEnd) {
    const endItems: SessionActionItem[] = []
    // Waiting for input means there is no turn left to finish.
    if (end.supported && session.status === 'running' && !end.armed) {
      endItems.push({
        key: 'whenDone',
        label: t('endSession.whenDone'),
        hint: t('endSession.whenDoneHint'),
        icon: HourglassMedium,
        onPress: () => void end.terminateWhenDone(),
        testID: 'session-action-when-done',
      })
    }
    endItems.push({
      key: 'terminate',
      label: t('endSession.terminate'),
      hint: t('endSession.terminateHint'),
      icon: Power,
      destructive: true,
      onPress: end.terminate,
      testID: 'session-action-terminate',
    })
    if (end.supported) {
      endItems.push(
        {
          key: 'force',
          label: t('endSession.force'),
          hint: t('endSession.forceHint'),
          icon: Lightning,
          destructive: true,
          onPress: end.forceTerminate,
          testID: 'session-action-force',
        },
        {
          key: 'delete',
          label: t('endSession.delete'),
          hint: t('endSession.deleteHint', { agent }),
          icon: Trash,
          destructive: true,
          dividerBefore: true,
          onPress: end.requestDelete,
          testID: 'session-action-delete',
        },
      )
    }
    endItems[0] = { ...endItems[0], endSection: true }
    items.push(...endItems)
  }

  const favoriteLabel = isFavorite ? t('swipe.unfavorite') : t('swipe.favorite')
  const leading: SwipeAction[] = [
    { key: 'favorite', label: favoriteLabel, icon: Star, color: theme.status.waiting, onPress: toggleFavorite, testID: 'session-swipe-favorite' },
  ]
  const trailing: SwipeAction[] = [
    { key: 'rename', label: t('swipe.rename'), icon: PencilSimple, color: theme.text.accent, onPress: () => setRenameVisible(true), testID: 'session-swipe-rename' },
  ]
  if (canEnd) {
    trailing.push({ key: 'terminate', label: t('swipe.terminate'), icon: Power, color: theme.status.idle, onPress: end.terminate, testID: 'session-swipe-terminate' })
    if (end.supported) {
      trailing.push({ key: 'delete', label: t('swipe.delete'), icon: Trash, color: theme.status.failed, onPress: end.requestDelete, testID: 'session-swipe-delete' })
    }
  }
  // External sessions are read-only — no swipe actions either.
  const swipe = isExternal ? { leading: [], trailing: [] } : { leading, trailing }

  const overlays = isExternal ? null : (
    <>
      <SessionActionSheet
        visible={menuVisible}
        title={title}
        meta={meta}
        items={items}
        onClose={() => setMenuVisible(false)}
      />
      <EndSessionDialogs
        dialog={end.dialog}
        provider={session.provider}
        server={server}
        onConfirmDelete={end.confirmDelete}
        onConfirmWatchers={end.confirmWatchers}
        onDismiss={end.dismissDialog}
      />
      {renameVisible ? (
        <RenameSessionOverlay session={session} currentName={title} onClose={() => setRenameVisible(false)} />
      ) : null}
    </>
  )

  const endStatus = {
    armed: canEnd && end.armed,
    terminatingAt: canEnd ? end.terminatingAt : undefined,
    onForce: end.supported ? end.forceTerminate : undefined,
  }

  return {
    handlePress,
    handleLongPress,
    handleMenuPress: isExternal ? undefined : handleMenuPress,
    isExternal,
    overlays,
    endStatus,
    swipe,
  }
}

import { useCallback, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ArrowSquareOut, CopySimple, HourglassMedium, Lightning, Power, Trash } from 'phosphor-react-native'
import { EndSessionDialogs } from '@/components/sessions/EndSessionDialogs'
import { SessionActionSheet, type SessionActionItem } from '@/components/sessions/SessionActionSheet'
import { getSessionTierLabel } from '@/components/sessions/StateBadge'
import { getProviderLabel } from '@/components/sessions/providerLabel'
import { conversationHref } from '@/lib/conversationHref'
import { isExternalSession } from '@/lib/externalSession'
import { deriveSessionPresentation } from '@/lib/sessionPresentation'
import { useEndSession } from '@/hooks/useEndSession'
import { useNavLockStore } from '@/stores/navLock'
import type { MultiSession } from '@/types/api'

/**
 * Tap, long-press and ⋮ behaviour shared by every session row and card: an
 * external (observed) session opens the read-only conversation, a managed one
 * opens the PTY screen. Long-press and ⋮ open the action sheet on managed
 * sessions only; its End session group appears while the PTY is live.
 * Render `overlays` once next to the row.
 */
export function useSessionRowActions(session: MultiSession, title: string) {
  const router = useRouter()
  const { t } = useTranslation('sessions')
  const isExternal = isExternalSession(session)
  const presentation = deriveSessionPresentation(session)
  const canEnd = presentation.live && presentation.capabilities.canCancel
  const end = useEndSession(session.serverId, session.id, canEnd)
  const [menuVisible, setMenuVisible] = useState(false)

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
  }
}

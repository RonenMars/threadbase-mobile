import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Power, Star } from 'phosphor-react-native'
import type { SwipeAction } from '@/components/sessions/shared/SwipeableRow'
import { useTheme } from '@/contexts/ThemeContext'
import { useTerminateExternal } from '@/hooks/useTerminateExternal'
import { isExternalLive, isExternalSession } from '@/lib/externalSession'
import { buildFavoriteId, useQuickAccessStore } from '@/stores/quickAccess'
import type { MultiConversation } from '@/types/api'

/**
 * Swipe actions for a history conversation row. Favorite always applies. A
 * conversation whose CLI is still running outside Threadbase can also be
 * terminated, the same way as on its conversation screen; there is no
 * rename or delete for a conversation.
 */
export function useConversationSwipe(
  conv: MultiConversation,
  title: string,
): { leading: SwipeAction[]; trailing: SwipeAction[] } {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const favoriteId = buildFavoriteId(conv.serverId, 'conversation', conv.id)
  const isFavorite = useQuickAccessStore((s) => s.favorites.some((f) => f.id === favoriteId))
  const requestTerminate = useTerminateExternal(conv.serverId, conv.id)

  const toggleFavorite = useCallback(() => {
    const { pinItem, unpinItem } = useQuickAccessStore.getState()
    if (isFavorite) {
      unpinItem(favoriteId)
      return
    }
    pinItem({ type: 'conversation', id: favoriteId, label: title, serverId: conv.serverId, conversationId: conv.id })
  }, [isFavorite, favoriteId, title, conv.serverId, conv.id])

  return {
    leading: [
      {
        key: 'favorite',
        label: isFavorite ? t('swipe.unfavorite') : t('swipe.favorite'),
        icon: Star,
        color: theme.status.waiting,
        onPress: toggleFavorite,
        testID: 'conversation-swipe-favorite',
      },
    ],
    trailing:
      isExternalSession(conv) && isExternalLive(conv)
        ? [
            {
              key: 'terminate',
              label: t('swipe.terminate'),
              icon: Power,
              color: theme.status.idle,
              onPress: requestTerminate,
              testID: 'conversation-swipe-terminate',
            },
          ]
        : [],
  }
}

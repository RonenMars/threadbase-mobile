import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Star } from 'phosphor-react-native'
import type { SwipeAction } from '@/components/sessions/shared/SwipeableRow'
import { useTheme } from '@/contexts/ThemeContext'
import { buildFavoriteId, useQuickAccessStore } from '@/stores/quickAccess'
import type { MultiConversation } from '@/types/api'

/**
 * Swipe actions for a history conversation row. A conversation has no live
 * process to end or rename, so favorite is the only action.
 */
export function useConversationSwipe(conv: MultiConversation, title: string): { leading: SwipeAction[] } {
  const { t } = useTranslation('sessions')
  const theme = useTheme()
  const favoriteId = buildFavoriteId(conv.serverId, 'conversation', conv.id)
  const isFavorite = useQuickAccessStore((s) => s.favorites.some((f) => f.id === favoriteId))

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
  }
}

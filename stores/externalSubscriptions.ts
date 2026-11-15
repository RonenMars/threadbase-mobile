import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { sessionKey } from '@/stores/sessionNames'

/**
 * External sessions this device asked to be pushed about. A hint only: the
 * server has no list endpoint and prunes a subscription after 14 days idle.
 */
interface ExternalSubscriptionsStore {
  subscribed: Record<string, true>
  isSubscribed: (serverId: string, conversationId: string) => boolean
  setSubscribed: (serverId: string, conversationId: string, on: boolean) => void
}

export const useExternalSubscriptionsStore = create<ExternalSubscriptionsStore>()(
  persist(
    (set, get) => ({
      subscribed: {},
      isSubscribed: (serverId, conversationId) =>
        get().subscribed[sessionKey(serverId, conversationId)] === true,
      setSubscribed: (serverId, conversationId, on) =>
        set((s) => {
          const subscribed = { ...s.subscribed }
          const key = sessionKey(serverId, conversationId)
          if (on) subscribed[key] = true
          else delete subscribed[key]
          return { subscribed }
        }),
    }),
    {
      name: 'threadbase_external_subscriptions',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ subscribed: s.subscribed }),
    }
  )
)

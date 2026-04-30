import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NotificationPreferences } from '@/types/api'
import type { SessionsLayout } from '@/types/ui'

export type AddServerAction = 'ask' | 'add' | 'replace' | 'keep'
const ASYNC_KEY_SETTINGS = 'threadbase_settings'

interface SettingsStore {
  colorScheme: 'dark' | 'light' | 'system'
  completedSessionFadeMs: number
  terminalMaxLines: number
  notifications: NotificationPreferences
  historyMessageDisplay: 'first' | 'last'
  addServerAction: AddServerAction
  sessionsLayout: SessionsLayout
  setColorScheme: (scheme: 'dark' | 'light' | 'system') => void
  setCompletedSessionFadeMs: (ms: number) => void
  setTerminalMaxLines: (n: number) => void
  setNotifications: (prefs: Partial<NotificationPreferences>) => void
  setHistoryMessageDisplay: (v: 'first' | 'last') => void
  setAddServerAction: (v: AddServerAction) => void
  setSessionsLayout: (v: SessionsLayout) => void
  hydrate: () => Promise<void>
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  waitingInput: true,
  sessionComplete: true,
  sessionFailed: true,
  diffReady: false,
  quietHoursEnabled: false,
  quietHoursFrom: '22:00',
  quietHoursTo: '08:00',
  showBadge: true,
}

interface PersistedSettings {
  notifications: NotificationPreferences
  historyMessageDisplay: 'first' | 'last'
  addServerAction: AddServerAction
  sessionsLayout: SessionsLayout
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  colorScheme: 'dark',
  completedSessionFadeMs: 60000,
  terminalMaxLines: 5000,
  notifications: DEFAULT_NOTIFICATIONS,
  historyMessageDisplay: 'first',
  addServerAction: 'ask',
  sessionsLayout: 'hub',

  setColorScheme: (colorScheme) => set({ colorScheme }),
  setCompletedSessionFadeMs: (completedSessionFadeMs) => set({ completedSessionFadeMs }),
  setTerminalMaxLines: (terminalMaxLines) => set({ terminalMaxLines }),
  setNotifications: (prefs) =>
    set((state) => ({
      notifications: { ...state.notifications, ...prefs },
    })),
  setHistoryMessageDisplay: (historyMessageDisplay) => set({ historyMessageDisplay }),
  setAddServerAction: (addServerAction) => set({ addServerAction }),
  setSessionsLayout: (sessionsLayout) => set({ sessionsLayout }),
  hydrate: async () => {
    const raw = await AsyncStorage.getItem(ASYNC_KEY_SETTINGS)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    set((state) => ({
      notifications: parsed.notifications
        ? { ...state.notifications, ...parsed.notifications }
        : state.notifications,
      historyMessageDisplay: parsed.historyMessageDisplay ?? state.historyMessageDisplay,
      addServerAction: parsed.addServerAction ?? state.addServerAction,
      sessionsLayout: parsed.sessionsLayout ?? state.sessionsLayout,
    }))
  },
}))

useSettingsStore.subscribe((state) => {
  const payload: PersistedSettings = {
    notifications: state.notifications,
    historyMessageDisplay: state.historyMessageDisplay,
    addServerAction: state.addServerAction,
    sessionsLayout: state.sessionsLayout,
  }
  void AsyncStorage.setItem(ASYNC_KEY_SETTINGS, JSON.stringify(payload))
})

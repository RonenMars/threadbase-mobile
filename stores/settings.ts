import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NotificationPreferences } from '@/types/api'
import type { SessionsLayout } from '@/types/ui'
import type { ThemeId } from '@/constants/theme'

const VALID_THEME_IDS = new Set<string>(['dark', 'light', 'system', 'dracula', 'catppuccin', 'nord'])

function isValidThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && VALID_THEME_IDS.has(v)
}

export type AddServerAction = 'ask' | 'add' | 'replace' | 'keep'
const ASYNC_KEY_SETTINGS = 'threadbase_settings'

interface SettingsStore {
  colorScheme: ThemeId
  completedSessionFadeMs: number
  terminalMaxLines: number
  notifications: NotificationPreferences
  historyMessageDisplay: 'first' | 'last'
  addServerAction: AddServerAction
  sessionsLayout: SessionsLayout
  mergeChats: boolean
  setColorScheme: (scheme: ThemeId) => void
  setCompletedSessionFadeMs: (ms: number) => void
  setTerminalMaxLines: (n: number) => void
  setNotifications: (prefs: Partial<NotificationPreferences>) => void
  setHistoryMessageDisplay: (v: 'first' | 'last') => void
  setAddServerAction: (v: AddServerAction) => void
  setSessionsLayout: (v: SessionsLayout) => void
  setMergeChats: (v: boolean) => void
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
  colorScheme: ThemeId
  notifications: NotificationPreferences
  historyMessageDisplay: 'first' | 'last'
  addServerAction: AddServerAction
  sessionsLayout: SessionsLayout
  mergeChats: boolean
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  colorScheme: 'dark',
  completedSessionFadeMs: 60000,
  terminalMaxLines: 5000,
  notifications: DEFAULT_NOTIFICATIONS,
  historyMessageDisplay: 'first',
  addServerAction: 'ask',
  sessionsLayout: 'tree',
  mergeChats: true,

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
  setMergeChats: (mergeChats) => set({ mergeChats }),
  hydrate: async () => {
    const raw = await AsyncStorage.getItem(ASYNC_KEY_SETTINGS)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    set((state) => ({
      colorScheme: isValidThemeId(parsed.colorScheme) ? parsed.colorScheme : state.colorScheme,
      notifications: parsed.notifications
        ? { ...state.notifications, ...parsed.notifications }
        : state.notifications,
      historyMessageDisplay: parsed.historyMessageDisplay ?? state.historyMessageDisplay,
      addServerAction: parsed.addServerAction ?? state.addServerAction,
      sessionsLayout: parsed.sessionsLayout ?? state.sessionsLayout,
      mergeChats: parsed.mergeChats ?? state.mergeChats,
    }))
  },
}))

useSettingsStore.subscribe((state) => {
  const payload: PersistedSettings = {
    colorScheme: state.colorScheme,
    notifications: state.notifications,
    historyMessageDisplay: state.historyMessageDisplay,
    addServerAction: state.addServerAction,
    sessionsLayout: state.sessionsLayout,
    mergeChats: state.mergeChats,
  }
  void AsyncStorage.setItem(ASYNC_KEY_SETTINGS, JSON.stringify(payload))
})

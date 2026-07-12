import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NotificationPreferences } from '@/types/api'
import type { SessionsLayout } from '@/types/ui'
import { THEMES, appleGlassThemes } from '@/constants/theme'
import type { GlassThemeVariant, ThemeId } from '@/constants/theme'

const VALID_THEME_IDS = new Set<string>([...Object.keys(THEMES), 'system'])

const VALID_GLASS_THEME_VARIANTS = new Set<string>(Object.keys(appleGlassThemes))

function isValidThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && VALID_THEME_IDS.has(v)
}

function isValidGlassThemeVariant(v: unknown): v is GlassThemeVariant {
  return typeof v === 'string' && VALID_GLASS_THEME_VARIANTS.has(v)
}

export type AddServerAction = 'ask' | 'add' | 'replace' | 'keep'
const ASYNC_KEY_SETTINGS = 'threadbase_settings'

export type RowPreviewMode = 'first' | 'last' | 'auto' | 'off'
export type RowDensity = 'comfortable' | 'compact'
export type RowPathDisplay = 'smart' | 'full' | 'last-segment'
export type RowServerIndicator = 'auto' | 'always' | 'never'
export type RowServerChipVariant = 'label' | 'letter' | 'symbol'
export type RowTitleSource = 'title' | 'first' | 'last'
export type RowPreviewModalCount = 5 | 10 | 20

interface SettingsStore {
  colorScheme: ThemeId
  glassThemeVariant: GlassThemeVariant
  completedSessionFadeMs: number
  terminalMaxLines: number
  notifications: NotificationPreferences
  historyMessageDisplay: 'first' | 'last'
  addServerAction: AddServerAction
  sessionsLayout: SessionsLayout
  mergeChats: boolean
  locale: string
  biometricLock: boolean
  // Conversation row settings (Conversation list redesign §13).
  rowTitleSource: RowTitleSource
  rowPreviewMode: RowPreviewMode
  rowDensity: RowDensity
  rowPathDisplay: RowPathDisplay
  rowServerIndicator: RowServerIndicator
  rowServerChipVariant: RowServerChipVariant
  rowPreviewModalCount: RowPreviewModalCount
  setColorScheme: (scheme: ThemeId) => void
  setGlassThemeVariant: (variant: GlassThemeVariant) => void
  setCompletedSessionFadeMs: (ms: number) => void
  setTerminalMaxLines: (n: number) => void
  setNotifications: (prefs: Partial<NotificationPreferences>) => void
  setHistoryMessageDisplay: (v: 'first' | 'last') => void
  setAddServerAction: (v: AddServerAction) => void
  setSessionsLayout: (v: SessionsLayout) => void
  setMergeChats: (v: boolean) => void
  setLocale: (locale: string) => void
  setBiometricLock: (v: boolean) => void
  setRowTitleSource: (v: RowTitleSource) => void
  setRowPreviewMode: (v: RowPreviewMode) => void
  setRowDensity: (v: RowDensity) => void
  setRowPathDisplay: (v: RowPathDisplay) => void
  setRowServerIndicator: (v: RowServerIndicator) => void
  setRowServerChipVariant: (v: RowServerChipVariant) => void
  setRowPreviewModalCount: (v: RowPreviewModalCount) => void
  autoNameFromMessage: boolean
  aiGeneratedNames: boolean
  setAutoNameFromMessage: (v: boolean) => void
  setAiGeneratedNames: (v: boolean) => void
  sessionView: 'chat' | 'terminal'
  setSessionView: (v: 'chat' | 'terminal') => void
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
  glassThemeVariant: GlassThemeVariant
  notifications: NotificationPreferences
  historyMessageDisplay: 'first' | 'last'
  addServerAction: AddServerAction
  sessionsLayout: SessionsLayout
  mergeChats: boolean
  locale: string
  biometricLock: boolean
  rowTitleSource: RowTitleSource
  rowPreviewMode: RowPreviewMode
  rowDensity: RowDensity
  rowPathDisplay: RowPathDisplay
  rowServerIndicator: RowServerIndicator
  rowServerChipVariant: RowServerChipVariant
  rowPreviewModalCount: RowPreviewModalCount
  autoNameFromMessage: boolean
  aiGeneratedNames: boolean
  sessionView: 'chat' | 'terminal'
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  colorScheme: 'dark',
  glassThemeVariant: 'aurora',
  completedSessionFadeMs: 60000,
  terminalMaxLines: 5000,
  notifications: DEFAULT_NOTIFICATIONS,
  historyMessageDisplay: 'first',
  addServerAction: 'ask',
  sessionsLayout: 'classic',
  mergeChats: true,
  locale: 'en',
  biometricLock: false,
  autoNameFromMessage: true,
  aiGeneratedNames: false,
  sessionView: 'terminal',

  // Conversation row defaults (locked in plan §13).
  rowTitleSource: 'title',
  rowPreviewMode: 'auto',
  rowDensity: 'comfortable',
  rowPathDisplay: 'smart',
  rowServerIndicator: 'auto',
  rowServerChipVariant: 'label',
  rowPreviewModalCount: 10,

  setColorScheme: (colorScheme) => set({ colorScheme }),
  setGlassThemeVariant: (glassThemeVariant) => set({ glassThemeVariant }),
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
  setLocale: (locale) => set({ locale }),
  setBiometricLock: (biometricLock) => set({ biometricLock }),
  setAutoNameFromMessage: (autoNameFromMessage) => set({ autoNameFromMessage }),
  setAiGeneratedNames: (aiGeneratedNames) => set({ aiGeneratedNames }),
  setSessionView: (sessionView) => set({ sessionView }),
  setRowTitleSource: (rowTitleSource) => set({ rowTitleSource }),
  setRowPreviewMode: (rowPreviewMode) => set({ rowPreviewMode }),
  setRowDensity: (rowDensity) => set({ rowDensity }),
  setRowPathDisplay: (rowPathDisplay) => set({ rowPathDisplay }),
  setRowServerIndicator: (rowServerIndicator) => set({ rowServerIndicator }),
  setRowServerChipVariant: (rowServerChipVariant) => set({ rowServerChipVariant }),
  setRowPreviewModalCount: (rowPreviewModalCount) => set({ rowPreviewModalCount }),
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(ASYNC_KEY_SETTINGS)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>
      set((state) => ({
        colorScheme: isValidThemeId(parsed.colorScheme) ? parsed.colorScheme : state.colorScheme,
        glassThemeVariant: isValidGlassThemeVariant(parsed.glassThemeVariant)
          ? parsed.glassThemeVariant
          : state.glassThemeVariant,
        notifications: parsed.notifications
          ? { ...state.notifications, ...parsed.notifications }
          : state.notifications,
        historyMessageDisplay: parsed.historyMessageDisplay ?? state.historyMessageDisplay,
        addServerAction: parsed.addServerAction ?? state.addServerAction,
        sessionsLayout: parsed.sessionsLayout ?? state.sessionsLayout,
        mergeChats: parsed.mergeChats ?? state.mergeChats,
        locale: parsed.locale ?? state.locale,
        biometricLock: parsed.biometricLock ?? state.biometricLock,
        autoNameFromMessage: parsed.autoNameFromMessage ?? state.autoNameFromMessage,
        aiGeneratedNames: parsed.aiGeneratedNames ?? state.aiGeneratedNames,
        sessionView: parsed.sessionView === 'chat' ? 'chat' : state.sessionView,
        rowTitleSource: parsed.rowTitleSource ?? state.rowTitleSource,
        rowPreviewMode: parsed.rowPreviewMode ?? state.rowPreviewMode,
        rowDensity: parsed.rowDensity ?? state.rowDensity,
        rowPathDisplay: parsed.rowPathDisplay ?? state.rowPathDisplay,
        rowServerIndicator: parsed.rowServerIndicator ?? state.rowServerIndicator,
        rowServerChipVariant: parsed.rowServerChipVariant ?? state.rowServerChipVariant,
        rowPreviewModalCount: parsed.rowPreviewModalCount ?? state.rowPreviewModalCount,
      }))
    } catch {
      // storage unavailable or corrupted — ignore
    }
  },
}))

useSettingsStore.subscribe((state) => {
  const payload: PersistedSettings = {
    colorScheme: state.colorScheme,
    glassThemeVariant: state.glassThemeVariant,
    notifications: state.notifications,
    historyMessageDisplay: state.historyMessageDisplay,
    addServerAction: state.addServerAction,
    sessionsLayout: state.sessionsLayout,
    mergeChats: state.mergeChats,
    locale: state.locale,
    biometricLock: state.biometricLock,
    autoNameFromMessage: state.autoNameFromMessage,
    aiGeneratedNames: state.aiGeneratedNames,
    sessionView: state.sessionView,
    rowTitleSource: state.rowTitleSource,
    rowPreviewMode: state.rowPreviewMode,
    rowDensity: state.rowDensity,
    rowPathDisplay: state.rowPathDisplay,
    rowServerIndicator: state.rowServerIndicator,
    rowServerChipVariant: state.rowServerChipVariant,
    rowPreviewModalCount: state.rowPreviewModalCount,
  }
  AsyncStorage.setItem(ASYNC_KEY_SETTINGS, JSON.stringify(payload)).catch(() => {})
})

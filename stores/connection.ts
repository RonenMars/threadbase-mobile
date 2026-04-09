import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { ServerInfo } from '@/types/api'

const SECURE_KEY_API_KEY = 'threadbase_api_key'
const ASYNC_KEY_SERVER_URL = 'threadbase_server_url'

interface ConnectionStore {
  serverUrl: string
  apiKey: string
  isConnected: boolean
  serverInfo: ServerInfo | null
  isLoading: boolean
  setConnection: (url: string, key: string) => Promise<void>
  setConnected: (v: boolean, info?: ServerInfo) => void
  loadPersistedCredentials: () => Promise<void>
  clearConnection: () => Promise<void>
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  serverUrl: process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL ?? 'http://localhost:7070',
  apiKey: '',
  isConnected: false,
  serverInfo: null,
  isLoading: false,

  setConnection: async (url: string, key: string) => {
    await SecureStore.setItemAsync(SECURE_KEY_API_KEY, key)
    // AsyncStorage for non-sensitive URL
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    await AsyncStorage.setItem(ASYNC_KEY_SERVER_URL, url)
    set({ serverUrl: url, apiKey: key })
  },

  setConnected: (v: boolean, info?: ServerInfo) => {
    set({ isConnected: v, serverInfo: info ?? null })
  },

  loadPersistedCredentials: async () => {
    set({ isLoading: true })
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
      const [url, key] = await Promise.all([
        AsyncStorage.getItem(ASYNC_KEY_SERVER_URL),
        SecureStore.getItemAsync(SECURE_KEY_API_KEY),
      ])
      set({
        serverUrl: url ?? process.env.EXPO_PUBLIC_DEFAULT_SERVER_URL ?? 'http://localhost:7070',
        apiKey: key ?? '',
      })
    } finally {
      set({ isLoading: false })
    }
  },

  clearConnection: async () => {
    await SecureStore.deleteItemAsync(SECURE_KEY_API_KEY)
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    await AsyncStorage.removeItem(ASYNC_KEY_SERVER_URL)
    set({ serverUrl: '', apiKey: '', isConnected: false, serverInfo: null })
  },
}))

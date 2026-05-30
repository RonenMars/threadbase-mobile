import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSettingsStore } from '@/stores/settings'

beforeEach(() => {
  ;(AsyncStorage.setItem as jest.Mock).mockClear()
  ;(AsyncStorage.getItem as jest.Mock).mockClear()
  useSettingsStore.setState({
    autoNameFromMessage: true,
    aiGeneratedNames: false,
  } as any)
})

describe('SettingsStore – session naming flags', () => {
  it('autoNameFromMessage defaults to true', () => {
    expect(useSettingsStore.getState().autoNameFromMessage).toBe(true)
  })

  it('aiGeneratedNames defaults to false', () => {
    expect(useSettingsStore.getState().aiGeneratedNames).toBe(false)
  })

  it('setAutoNameFromMessage updates flag', () => {
    useSettingsStore.getState().setAutoNameFromMessage(false)
    expect(useSettingsStore.getState().autoNameFromMessage).toBe(false)
  })

  it('setAiGeneratedNames updates flag', () => {
    useSettingsStore.getState().setAiGeneratedNames(true)
    expect(useSettingsStore.getState().aiGeneratedNames).toBe(true)
  })
})

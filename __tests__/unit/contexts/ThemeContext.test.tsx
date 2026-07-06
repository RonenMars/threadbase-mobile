import React from 'react'
import { renderHook } from '@testing-library/react-native'
import { useSettingsStore } from '@/stores/settings'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import { dark, dracula, catppuccin, nord, light, appleGlassThemes } from '@/constants/theme'

// Use the real ThemeContext so the provider/hook contract tests remain meaningful
jest.unmock('@/contexts/ThemeContext')

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

beforeEach(() => {
  useSettingsStore.setState({ colorScheme: 'dark', glassThemeVariant: 'aurora' })
})

describe('useTheme', () => {
  it('returns dark theme by default', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(dark.bg.primary)
    expect(result.current.text.accent).toBe(dark.text.accent)
  })

  it('returns dracula theme when colorScheme is dracula', async () => {
    useSettingsStore.setState({ colorScheme: 'dracula' })
    const { result } = await renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(dracula.bg.primary)
    expect(result.current.text.accent).toBe(dracula.text.accent)
  })

  it('returns catppuccin theme when colorScheme is catppuccin', async () => {
    useSettingsStore.setState({ colorScheme: 'catppuccin' })
    const { result } = await renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(catppuccin.bg.primary)
  })

  it('returns nord theme when colorScheme is nord', async () => {
    useSettingsStore.setState({ colorScheme: 'nord' })
    const { result } = await renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(nord.bg.primary)
  })

  it('returns light theme when colorScheme is light', async () => {
    useSettingsStore.setState({ colorScheme: 'light' })
    const { result } = await renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(light.bg.primary)
    expect(result.current.text.accent).toBe(light.text.accent)
  })

  it('resolves system to light when OS scheme is light', async () => {
    jest.mocked(require('react-native').useColorScheme).mockReturnValue('light')
    useSettingsStore.setState({ colorScheme: 'system' })
    const { result } = await renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(light.bg.primary)
  })

  it('resolves system to dark when OS scheme is dark', async () => {
    jest.mocked(require('react-native').useColorScheme).mockReturnValue('dark')
    useSettingsStore.setState({ colorScheme: 'system' })
    const { result } = await renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(dark.bg.primary)
  })

  it('returns selected Apple Glass variant when colorScheme is appleGlass', async () => {
    useSettingsStore.setState({ colorScheme: 'appleGlass', glassThemeVariant: 'sunset' })
    const { result } = await renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.secondary).toBe(appleGlassThemes.sunset.bg.secondary)
    expect(result.current.glass?.overlayColor).toBe(appleGlassThemes.sunset.glass?.overlayColor)
  })

  it('throws when used outside ThemeProvider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(renderHook(() => useTheme())).rejects.toThrow('useTheme must be used within ThemeProvider')
    spy.mockRestore()
  })
})

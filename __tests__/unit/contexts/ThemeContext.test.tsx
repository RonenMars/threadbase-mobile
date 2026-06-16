import React from 'react'
import { renderHook } from '@testing-library/react-native'
import { useSettingsStore } from '@/stores/settings'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import { dark, dracula, catppuccin, nord, light } from '@/constants/theme'

// Use the real ThemeContext so the provider/hook contract tests remain meaningful
jest.unmock('@/contexts/ThemeContext')

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

beforeEach(() => {
  useSettingsStore.setState({ colorScheme: 'dark' })
})

describe('useTheme', () => {
  it('returns dark theme by default', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(dark.bg.primary)
    expect(result.current.text.accent).toBe(dark.text.accent)
  })

  it('returns dracula theme when colorScheme is dracula', () => {
    useSettingsStore.setState({ colorScheme: 'dracula' })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(dracula.bg.primary)
    expect(result.current.text.accent).toBe(dracula.text.accent)
  })

  it('returns catppuccin theme when colorScheme is catppuccin', () => {
    useSettingsStore.setState({ colorScheme: 'catppuccin' })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(catppuccin.bg.primary)
  })

  it('returns nord theme when colorScheme is nord', () => {
    useSettingsStore.setState({ colorScheme: 'nord' })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(nord.bg.primary)
  })

  it('returns light theme when colorScheme is light', () => {
    useSettingsStore.setState({ colorScheme: 'light' })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(light.bg.primary)
    expect(result.current.text.accent).toBe(light.text.accent)
  })

  it('resolves system to light when OS scheme is light', () => {
    jest.mocked(require('react-native').useColorScheme).mockReturnValue('light')
    useSettingsStore.setState({ colorScheme: 'system' })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(light.bg.primary)
  })

  it('resolves system to dark when OS scheme is dark', () => {
    jest.mocked(require('react-native').useColorScheme).mockReturnValue('dark')
    useSettingsStore.setState({ colorScheme: 'system' })
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.bg.primary).toBe(dark.bg.primary)
  })

  it('throws when used outside ThemeProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within ThemeProvider')
    spy.mockRestore()
  })
})

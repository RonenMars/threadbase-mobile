import React, { createContext, useContext, useMemo } from 'react'
import { useColorScheme, View } from 'react-native'
import { vars } from 'nativewind'
import { useSettingsStore } from '@/stores/settings'
import { THEMES, type Theme, type ThemeId } from '@/constants/theme'

const ThemeContext = createContext<Theme | null>(null)

function themeToVars(theme: Theme): Record<string, string> {
  return {
    '--color-bg-primary': theme.bg.primary,
    '--color-bg-secondary': theme.bg.secondary,
    '--color-bg-card': theme.bg.card,
    '--color-text-primary': theme.text.primary,
    '--color-text-secondary': theme.text.secondary,
    '--color-text-accent': theme.text.accent,
    '--color-text-danger': theme.text.danger,
    '--color-text-warning': theme.text.warning,
    '--color-text-success': theme.text.success,
    '--color-border': theme.border,
    '--color-status-running': theme.status.running,
    '--color-status-waiting': theme.status.waiting,
    '--color-status-failed': theme.status.failed,
    '--color-status-completed': theme.status.completed,
    '--color-status-idle': theme.status.idle,
  }
}

function resolveTheme(colorScheme: ThemeId, systemScheme: 'light' | 'dark' | null | undefined): Theme {
  if (colorScheme === 'system') {
    return THEMES[systemScheme === 'light' ? 'light' : 'dark']
  }
  return THEMES[colorScheme]
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useSettingsStore((s) => s.colorScheme)
  const systemScheme = useColorScheme() as 'light' | 'dark' | null | undefined
  const theme = useMemo(() => resolveTheme(colorScheme, systemScheme), [colorScheme, systemScheme])
  const cssVars = useMemo(() => vars(themeToVars(theme)), [theme])

  return (
    <ThemeContext.Provider value={theme}>
      <View style={[{ flex: 1 }, cssVars]}>
        {children}
      </View>
    </ThemeContext.Provider>
  )
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext)
  if (ctx === null) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}

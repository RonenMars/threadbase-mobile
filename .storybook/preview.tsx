import React, { useEffect } from 'react'
import type { Preview } from '@storybook/react-native-web-vite'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useSettingsStore } from '@/stores/settings'
import { THEMES, type ThemeId } from '@/constants/theme'
import '@/test-utils/i18n-setup'
import '@/global.css'

const THEME_OPTIONS: Exclude<ThemeId, 'system' | 'appleGlass'>[] = ['dark', 'light', 'dracula', 'catppuccin']

function ThemedStory({ themeId, children }: { themeId: ThemeId; children: React.ReactNode }) {
  useEffect(() => {
    useSettingsStore.setState({ colorScheme: themeId })
  }, [themeId])

  return (
    <ThemeProvider>
      <div style={{ minHeight: '100%', background: THEMES[themeId === 'system' ? 'dark' : themeId].bg.primary }}>
        {children}
      </div>
    </ThemeProvider>
  )
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Threadbase theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: THEME_OPTIONS,
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'dark',
  },
  decorators: [
    (Story, context) => (
      <ThemedStory themeId={context.globals.theme as ThemeId}>
        <Story />
      </ThemedStory>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview

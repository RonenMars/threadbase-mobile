import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from 'tailwindcss'
import type { StorybookConfig } from '@storybook/react-native-web-vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-native-web-vite',
    options: {
      modulesToTranspile: [
        'react-native-reanimated',
        'react-native-worklets',
        'phosphor-react-native',
        'nativewind',
        'react-native-css-interop',
      ],
      pluginReactOptions: {
        jsxImportSource: 'nativewind',
        babel: {
          plugins: ['react-native-worklets/plugin'],
        },
      },
    },
  },
  async viteFinal(viteConfig) {
    viteConfig.resolve = viteConfig.resolve ?? {}
    viteConfig.resolve.alias = {
      ...(viteConfig.resolve.alias ?? {}),
      '@': path.resolve(dirname, '..'),
    }
    viteConfig.css = {
      ...(viteConfig.css ?? {}),
      postcss: {
        plugins: [tailwindcss(path.resolve(dirname, '../tailwind.config.js'))],
      },
    }
    return viteConfig
  },
}

export default config

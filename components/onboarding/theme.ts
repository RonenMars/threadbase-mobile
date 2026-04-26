import { Platform } from 'react-native'

// Color tokens lifted from design/colors_and_type.css.
// Visual review depends on these exact keys.
export const colors = {
  ink0: '#04070b',
  ink1: '#070b11',
  ink2: '#0b1220',
  ink3: '#0f1a2c',
  ink4: '#152238',
  ink5: '#1a2d47',
  ink6: '#243a59',
  ink7: '#2a4060',

  fg0: '#f4f7fb',
  fg1: '#d6e0ee',
  fg2: '#9fb0c8',
  fg3: '#6c809b',
  fg4: '#4a5b76',

  blue400: '#63b3ff',
  blue500: '#4a9ef0',

  amber400: '#f08a24',
  amber500: '#d6770e',

  green400: '#4ade80',
  green500: '#16a34a',

  red400: '#ff6b6b',
} as const

// Inter and JetBrainsMono should be bundled via expo-font in production.
// Until they are, fall back to the platform's system + monospace fonts so
// the layout still works in dev/preview builds.
export const fonts = {
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' })!,
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!,
} as const

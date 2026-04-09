export const dark = {
  bg: {
    primary: '#0d1117',
    secondary: '#161b22',
    card: '#21262d',
  },
  text: {
    primary: '#e6edf3',
    secondary: '#7d8590',
    accent: '#58a6ff',
    danger: '#f85149',
    warning: '#d29922',
    success: '#3fb950',
  },
  border: '#30363d',
  status: {
    running: '#3fb950',
    waiting: '#d29922',
    failed: '#f85149',
    completed: '#58a6ff',
    idle: '#7d8590',
  },
} as const

export const light = {
  bg: {
    primary: '#ffffff',
    secondary: '#f6f8fa',
    card: '#ffffff',
  },
  text: {
    primary: '#1f2328',
    secondary: '#57606a',
    accent: '#0969da',
    danger: '#cf222e',
    warning: '#9a6700',
    success: '#1a7f37',
  },
  border: '#d0d7de',
  status: {
    running: '#1a7f37',
    waiting: '#9a6700',
    failed: '#cf222e',
    completed: '#0969da',
    idle: '#57606a',
  },
} as const

export type Theme = typeof dark

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const

export const font = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
} as const

export const TABLET_BREAKPOINT = 768

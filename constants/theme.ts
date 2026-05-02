export type Theme = {
  readonly bg: {
    readonly primary: string
    readonly secondary: string
    readonly card: string
  }
  readonly text: {
    readonly primary: string
    readonly secondary: string
    readonly accent: string
    readonly danger: string
    readonly warning: string
    readonly success: string
  }
  readonly border: string
  readonly status: {
    readonly running: string
    readonly waiting: string
    readonly failed: string
    readonly completed: string
    readonly idle: string
  }
}

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
} as const satisfies Theme

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
} as const satisfies Theme

export const dracula = {
  bg: {
    primary: '#282a36',
    secondary: '#21222c',
    card: '#44475a',
  },
  text: {
    primary: '#f8f8f2',
    secondary: '#6272a4',
    accent: '#bd93f9',
    danger: '#ff5555',
    warning: '#ffb86c',
    success: '#50fa7b',
  },
  border: '#6272a4',
  status: {
    running: '#50fa7b',
    waiting: '#ffb86c',
    failed: '#ff5555',
    completed: '#bd93f9',
    idle: '#6272a4',
  },
} as const satisfies Theme

export const catppuccin = {
  bg: {
    primary: '#1e1e2e',
    secondary: '#181825',
    card: '#313244',
  },
  text: {
    primary: '#cdd6f4',
    secondary: '#6c7086',
    accent: '#cba6f7',
    danger: '#f38ba8',
    warning: '#fab387',
    success: '#a6e3a1',
  },
  border: '#45475a',
  status: {
    running: '#a6e3a1',
    waiting: '#fab387',
    failed: '#f38ba8',
    completed: '#cba6f7',
    idle: '#6c7086',
  },
} as const satisfies Theme

export const nord = {
  bg: {
    primary: '#2e3440',
    secondary: '#242933',
    card: '#3b4252',
  },
  text: {
    primary: '#eceff4',
    secondary: '#4c566a',
    accent: '#88c0d0',
    danger: '#bf616a',
    warning: '#ebcb8b',
    success: '#a3be8c',
  },
  border: '#4c566a',
  status: {
    running: '#a3be8c',
    waiting: '#ebcb8b',
    failed: '#bf616a',
    completed: '#88c0d0',
    idle: '#4c566a',
  },
} as const satisfies Theme

export type ThemeId = 'dark' | 'light' | 'system' | 'dracula' | 'catppuccin' | 'nord'

export const THEMES: Record<Exclude<ThemeId, 'system'>, Theme> = {
  dark,
  light,
  dracula,
  catppuccin,
  nord,
}

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

export type Theme = {
  readonly colorMode: 'light' | 'dark'
  readonly bg: {
    readonly primary: string
    readonly secondary: string
    readonly card: string
  }
  readonly text: {
    readonly primary: string
    readonly secondary: string
    readonly accent: string
    readonly onAccent: string
    /** Search-match highlighter fill — a high-contrast color, used identically
     *  in every bubble type and the tool card. */
    readonly highlight: string
    /** Text drawn on top of `highlight`. */
    readonly onHighlight: string
    readonly danger: string
    readonly warning: string
    readonly success: string
    readonly beta: string
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
  colorMode: 'dark' as const,
  bg: {
    primary: '#0d1117',
    secondary: '#161b22',
    card: '#21262d',
  },
  text: {
    primary: '#e6edf3',
    secondary: '#858d97',
    accent: '#58a6ff',
    onAccent: '#0d1117',
    highlight: '#f2cc60',
    onHighlight: '#0d1117',
    danger: '#f85149',
    warning: '#d29922',
    success: '#3fb950',
    beta: '#d29922',
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
  colorMode: 'light' as const,
  bg: {
    primary: '#ffffff',
    secondary: '#f6f8fa',
    card: '#ffffff',
  },
  text: {
    primary: '#1f2328',
    secondary: '#57606a',
    accent: '#0969da',
    onAccent: '#ffffff',
    highlight: '#ffd33d',
    onHighlight: '#1f2328',
    danger: '#cf222e',
    warning: '#9a6700',
    success: '#1a7f37',
    beta: '#9a6700',
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

export const catppuccin = {
  colorMode: 'dark' as const,
  bg: {
    primary: '#1e1e2e',
    secondary: '#181825',
    card: '#313244',
  },
  text: {
    primary: '#cdd6f4',
    secondary: '#a6adc8',
    accent: '#cba6f7',
    onAccent: '#1e1e2e',
    highlight: '#f9e2af',
    onHighlight: '#1e1e2e',
    danger: '#f38ba8',
    warning: '#fab387',
    success: '#a6e3a1',
    beta: '#fab387',
  },
  border: '#45475a',
  status: {
    running: '#a6e3a1',
    waiting: '#fab387',
    failed: '#f38ba8',
    completed: '#cba6f7',
    idle: '#777b92',
  },
} as const satisfies Theme

export const nord = {
  colorMode: 'dark' as const,
  bg: {
    primary: '#2e3440',
    secondary: '#242933',
    card: '#3b4252',
  },
  text: {
    primary: '#eceff4',
    secondary: '#a7b1c4',
    accent: '#88c0d0',
    onAccent: '#2e3440',
    highlight: '#ebcb8b',
    onHighlight: '#2e3440',
    danger: '#bf616a',
    warning: '#ebcb8b',
    success: '#a3be8c',
    beta: '#ebcb8b',
  },
  border: '#4c566a',
  status: {
    running: '#a3be8c',
    waiting: '#ebcb8b',
    failed: '#bf616a',
    completed: '#88c0d0',
    idle: '#818da5',
  },
} as const satisfies Theme

// Catppuccin Latte — light sibling of Catppuccin Mocha (MIT)
export const catppuccinLatte = {
  colorMode: 'light' as const,
  bg: {
    primary: '#eff1f5',
    secondary: '#e6e9ef',
    card: '#dce0e8',
  },
  text: {
    primary: '#4c4f69',
    secondary: '#5c5f77',
    accent: '#8839ef',
    onAccent: '#eff1f5',
    highlight: '#df8e1d',
    onHighlight: '#eff1f5',
    danger: '#d20f39',
    warning: '#b27117',
    success: '#40a02b',
    beta: '#b27117',
  },
  border: '#bcc0cc',
  status: {
    running: '#40a02b',
    waiting: '#b27117',
    failed: '#d20f39',
    completed: '#8839ef',
    idle: '#797e94',
  },
} as const satisfies Theme

// One Dark — Atom's iconic dark theme (MIT)
export const oneDark = {
  colorMode: 'dark' as const,
  bg: {
    primary: '#282c34',
    secondary: '#21252b',
    card: '#2c313c',
  },
  text: {
    primary: '#abb2bf',
    secondary: '#9299a5',
    accent: '#61afef',
    onAccent: '#282c34',
    highlight: '#e5c07b',
    onHighlight: '#282c34',
    danger: '#e06c75',
    warning: '#e5c07b',
    success: '#98c379',
    beta: '#e5c07b',
  },
  border: '#3e4451',
  status: {
    running: '#98c379',
    waiting: '#e5c07b',
    failed: '#e06c75',
    completed: '#61afef',
    idle: '#727b8b',
  },
} as const satisfies Theme

// Rosé Pine Dawn — light sibling of Rosé Pine (MIT)
export const rosePineDawn = {
  colorMode: 'light' as const,
  bg: {
    primary: '#faf4ed',
    secondary: '#fffaf3',
    card: '#f2e9de',
  },
  text: {
    primary: '#575279',
    secondary: '#6c667b',
    accent: '#907aa9',
    onAccent: '#191724',
    highlight: '#ea9d34',
    onHighlight: '#575279',
    danger: '#b4637a',
    warning: '#be7614',
    success: '#286983',
    beta: '#be7614',
  },
  border: '#dfdad9',
  status: {
    // Working must read as green, not the pine accent — see docs/design/session-list.
    running: '#1a7f37',
    waiting: '#be7614',
    failed: '#b4637a',
    completed: '#907aa9',
    idle: '#898498',
  },
} as const satisfies Theme

// Tokyo Night Light — light sibling of Tokyo Night (MIT)
export const tokyoNightLight = {
  colorMode: 'light' as const,
  bg: {
    primary: '#d5d6db',
    secondary: '#cbccd1',
    card: '#e9e9ec',
  },
  text: {
    primary: '#343b58',
    secondary: '#55556d',
    accent: '#2959aa',
    onAccent: '#d5d6db',
    highlight: '#d9a521',
    onHighlight: '#343b58',
    danger: '#8c4351',
    warning: '#8f5e15',
    success: '#485e30',
    beta: '#8f5e15',
  },
  border: '#b9b9c3',
  status: {
    running: '#485e30',
    waiting: '#8f5e15',
    failed: '#8c4351',
    completed: '#2959aa',
    idle: '#6f6f8f',
  },
} as const satisfies Theme

export type ThemeId =
  | 'dark'
  | 'light'
  | 'system'
  | 'catppuccin'
  | 'catppuccinLatte'
  | 'nord'
  | 'oneDark'
  | 'rosePineDawn'
  | 'tokyoNightLight'

export const THEMES: Record<Exclude<ThemeId, 'system'>, Theme> = {
  dark,
  light,
  catppuccin,
  catppuccinLatte,
  nord,
  oneDark,
  rosePineDawn,
  tokyoNightLight,
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

export { PROVIDER_COLOR as brand } from './providers'

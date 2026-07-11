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
  readonly glass?: {
    readonly tint: 'light' | 'dark' | 'default'
    readonly intensity: number
    readonly overlayColor: string
    /** Solid background for modals that stack on top of glass surfaces,
     *  preventing translucent-over-translucent text bleed. */
    readonly opaqueSurface: string
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
    secondary: '#7d8590',
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

export const dracula = {
  colorMode: 'dark' as const,
  bg: {
    primary: '#282a36',
    secondary: '#21222c',
    card: '#44475a',
  },
  text: {
    primary: '#f8f8f2',
    secondary: '#6272a4',
    accent: '#bd93f9',
    onAccent: '#282a36',
    highlight: '#f1fa8c',
    onHighlight: '#282a36',
    danger: '#ff5555',
    warning: '#ffb86c',
    success: '#50fa7b',
    beta: '#ffb86c',
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
    idle: '#6c7086',
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
    secondary: '#4c566a',
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
    idle: '#4c566a',
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
    warning: '#df8e1d',
    success: '#40a02b',
    beta: '#df8e1d',
  },
  border: '#bcc0cc',
  status: {
    running: '#40a02b',
    waiting: '#df8e1d',
    failed: '#d20f39',
    completed: '#8839ef',
    idle: '#9ca0b0',
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
    secondary: '#5c6370',
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
    idle: '#5c6370',
  },
} as const satisfies Theme

// One Light — Atom's light sibling of One Dark (MIT)
export const oneLight = {
  colorMode: 'light' as const,
  bg: {
    primary: '#fafafa',
    secondary: '#f0f0f0',
    card: '#ffffff',
  },
  text: {
    primary: '#383a42',
    secondary: '#696c77',
    accent: '#4078f2',
    onAccent: '#fafafa',
    highlight: '#eab700',
    onHighlight: '#383a42',
    danger: '#e45649',
    warning: '#986801',
    success: '#50a14f',
    beta: '#986801',
  },
  border: '#d3d3d3',
  status: {
    running: '#50a14f',
    waiting: '#986801',
    failed: '#e45649',
    completed: '#4078f2',
    idle: '#a0a1a7',
  },
} as const satisfies Theme

// Solarized Dark — Ethan Schoonover's precision palette (MIT)
export const solarizedDark = {
  colorMode: 'dark' as const,
  bg: {
    primary: '#002b36',
    secondary: '#073642',
    card: '#073642',
  },
  text: {
    primary: '#839496',
    secondary: '#586e75',
    accent: '#268bd2',
    onAccent: '#002b36',
    highlight: '#b58900',
    onHighlight: '#fdf6e3',
    danger: '#dc322f',
    warning: '#b58900',
    success: '#859900',
    beta: '#b58900',
  },
  border: '#073642',
  status: {
    running: '#859900',
    waiting: '#b58900',
    failed: '#dc322f',
    completed: '#268bd2',
    idle: '#586e75',
  },
} as const satisfies Theme

// Solarized Light — light sibling of Solarized Dark (MIT)
export const solarizedLight = {
  colorMode: 'light' as const,
  bg: {
    primary: '#fdf6e3',
    secondary: '#eee8d5',
    card: '#fdf6e3',
  },
  text: {
    primary: '#657b83',
    secondary: '#93a1a1',
    accent: '#268bd2',
    onAccent: '#fdf6e3',
    highlight: '#e0b000',
    onHighlight: '#002b36',
    danger: '#dc322f',
    warning: '#b58900',
    success: '#859900',
    beta: '#b58900',
  },
  border: '#eee8d5',
  status: {
    running: '#859900',
    waiting: '#b58900',
    failed: '#dc322f',
    completed: '#268bd2',
    idle: '#93a1a1',
  },
} as const satisfies Theme

// Rosé Pine — muted, warm dark theme (MIT)
export const rosePine = {
  colorMode: 'dark' as const,
  bg: {
    primary: '#191724',
    secondary: '#1f1d2e',
    card: '#26233a',
  },
  text: {
    primary: '#e0def4',
    secondary: '#6e6a86',
    accent: '#c4a7e7',
    onAccent: '#191724',
    highlight: '#f6c177',
    onHighlight: '#191724',
    danger: '#eb6f92',
    warning: '#f6c177',
    success: '#31748f',
    beta: '#f6c177',
  },
  border: '#403d52',
  status: {
    running: '#31748f',
    waiting: '#f6c177',
    failed: '#eb6f92',
    completed: '#c4a7e7',
    idle: '#6e6a86',
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
    secondary: '#9893a5',
    accent: '#907aa9',
    onAccent: '#faf4ed',
    highlight: '#ea9d34',
    onHighlight: '#575279',
    danger: '#b4637a',
    warning: '#ea9d34',
    success: '#286983',
    beta: '#ea9d34',
  },
  border: '#dfdad9',
  status: {
    running: '#286983',
    waiting: '#ea9d34',
    failed: '#b4637a',
    completed: '#907aa9',
    idle: '#9893a5',
  },
} as const satisfies Theme

// Tokyo Night — cool blue-purple dark theme (MIT)
export const tokyoNight = {
  colorMode: 'dark' as const,
  bg: {
    primary: '#1a1b26',
    secondary: '#16161e',
    card: '#24283b',
  },
  text: {
    primary: '#c0caf5',
    secondary: '#565f89',
    accent: '#7aa2f7',
    onAccent: '#1a1b26',
    highlight: '#e0af68',
    onHighlight: '#1a1b26',
    danger: '#f7768e',
    warning: '#e0af68',
    success: '#9ece6a',
    beta: '#e0af68',
  },
  border: '#292e42',
  status: {
    running: '#9ece6a',
    waiting: '#e0af68',
    failed: '#f7768e',
    completed: '#7aa2f7',
    idle: '#565f89',
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
    secondary: '#8f8fa8',
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
    idle: '#8f8fa8',
  },
} as const satisfies Theme

export type GlassThemeVariant = 'aurora' | 'sunset' | 'midnight'

export const appleGlassThemes: Record<GlassThemeVariant, Theme> = {
  aurora: {
    colorMode: 'dark' as const,
    bg: {
      primary: 'transparent',
      secondary: 'rgba(24, 42, 54, 0.34)',
      card: 'rgba(255, 255, 255, 0.08)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.72)',
      accent: '#59d6ff',
      onAccent: '#ffffff',
      highlight: '#ffd166',
      onHighlight: '#182a36',
      danger: '#ff5d5d',
      warning: '#ffb84d',
      success: '#34d399',
      beta: '#ffb84d',
    },
    border: 'rgba(255, 255, 255, 0.16)',
    status: {
      running: '#34d399',
      waiting: '#ffb84d',
      failed: '#ff5d5d',
      completed: '#59d6ff',
      idle: 'rgba(255, 255, 255, 0.5)',
    },
    glass: {
      tint: 'dark' as const,
      intensity: 72,
      overlayColor: 'rgba(10, 20, 30, 0.22)',
      opaqueSurface: '#1c1c2e',
    },
  },
  sunset: {
    colorMode: 'dark' as const,
    bg: {
      primary: 'transparent',
      secondary: 'rgba(52, 28, 42, 0.34)',
      card: 'rgba(255, 255, 255, 0.1)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.72)',
      accent: '#ff9f7a',
      onAccent: '#ffffff',
      highlight: '#ffcc66',
      onHighlight: '#2a1020',
      danger: '#ff6b6b',
      warning: '#ffcc66',
      success: '#5eead4',
      beta: '#ffcc66',
    },
    border: 'rgba(255, 255, 255, 0.16)',
    status: {
      running: '#5eead4',
      waiting: '#ffcc66',
      failed: '#ff6b6b',
      completed: '#ff9f7a',
      idle: 'rgba(255, 255, 255, 0.5)',
    },
    glass: {
      tint: 'dark' as const,
      intensity: 76,
      overlayColor: 'rgba(34, 12, 24, 0.24)',
      opaqueSurface: '#2a1020',
    },
  },
  midnight: {
    colorMode: 'dark' as const,
    bg: {
      primary: 'transparent',
      secondary: 'rgba(18, 22, 46, 0.36)',
      card: 'rgba(255, 255, 255, 0.07)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
      accent: '#8cb3ff',
      onAccent: '#ffffff',
      highlight: '#f8d66d',
      onHighlight: '#10121e',
      danger: '#ff7b7b',
      warning: '#f8d66d',
      success: '#7dd3fc',
      beta: '#f8d66d',
    },
    border: 'rgba(255, 255, 255, 0.14)',
    status: {
      running: '#7dd3fc',
      waiting: '#f8d66d',
      failed: '#ff7b7b',
      completed: '#8cb3ff',
      idle: 'rgba(255, 255, 255, 0.48)',
    },
    glass: {
      tint: 'dark' as const,
      intensity: 70,
      overlayColor: 'rgba(8, 10, 24, 0.26)',
      opaqueSurface: '#10121e',
    },
  },
} as const

export type ThemeId =
  | 'dark'
  | 'light'
  | 'system'
  | 'dracula'
  | 'catppuccin'
  | 'catppuccinLatte'
  | 'nord'
  | 'oneDark'
  | 'oneLight'
  | 'solarizedDark'
  | 'solarizedLight'
  | 'rosePine'
  | 'rosePineDawn'
  | 'tokyoNight'
  | 'tokyoNightLight'
  | 'appleGlass'

export const THEMES: Record<Exclude<ThemeId, 'system'>, Theme> = {
  dark,
  light,
  dracula,
  catppuccin,
  catppuccinLatte,
  nord,
  oneDark,
  oneLight,
  solarizedDark,
  solarizedLight,
  rosePine,
  rosePineDawn,
  tokyoNight,
  tokyoNightLight,
  appleGlass: appleGlassThemes.aurora,
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

export const brand = {
  claude: '#E8622A',
  codex: '#7B5EA7',
} as const

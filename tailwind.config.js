/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          card: 'var(--color-bg-card)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          accent: 'var(--color-text-accent)',
          danger: 'var(--color-text-danger)',
          warning: 'var(--color-text-warning)',
          success: 'var(--color-text-success)',
        },
        accent: {
          DEFAULT: 'var(--color-text-accent)',
        },
        border: 'var(--color-border)',
        status: {
          running: 'var(--color-status-running)',
          waiting: 'var(--color-status-waiting)',
          failed: 'var(--color-status-failed)',
          idle: 'var(--color-status-idle)',
          completed: 'var(--color-status-completed)',
        },
      },
      fontSize: {
        'font-xs':   ['11px', { lineHeight: '15px' }],
        'font-sm':   ['13px', { lineHeight: '18px' }],
        'font-base': ['15px', { lineHeight: '20px' }],
        'font-lg':   ['17px', { lineHeight: '22px' }],
        'font-xl':   ['20px', { lineHeight: '26px' }],
        'font-xxl':  ['24px', { lineHeight: '30px' }],
      },
      borderRadius: {
        'radius-sm': '6px',
        'radius-md': '10px',
        'radius-lg': '16px',
      },
      fontFamily: {
        mono: ['SpaceMono', 'monospace'],
      },
    },
  },
  plugins: [],
}

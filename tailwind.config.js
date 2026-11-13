/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
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
        'font-xs':   ['14px', { lineHeight: '19px' }],
        'font-sm':   ['16px', { lineHeight: '22px' }],
        'font-base': ['17px', { lineHeight: '23px' }],
        'font-lg':   ['20px', { lineHeight: '26px' }],
        'font-xl':   ['23px', { lineHeight: '30px' }],
        'font-xxl':  ['27px', { lineHeight: '34px' }],
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

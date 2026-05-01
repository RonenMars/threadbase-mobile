/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
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
        accent: {
          DEFAULT: '#58a6ff',
          subtle: 'rgba(88,166,255,0.12)',
        },
        border: '#30363d',
        status: {
          running: '#3fb950',
          waiting: '#d29922',
          failed: '#f85149',
          idle: '#7d8590',
          completed: '#58a6ff',
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

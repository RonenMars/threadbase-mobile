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
        accent: '#58a6ff',
        border: '#30363d',
        status: {
          running: '#3fb950',
          waiting: '#d29922',
          failed: '#f85149',
          idle: '#7d8590',
          completed: '#58a6ff',
        },
      },
      fontFamily: {
        mono: ['SpaceMono', 'monospace'],
      },
    },
  },
  plugins: [],
}

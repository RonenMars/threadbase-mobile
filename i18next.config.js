module.exports = {
  locales: ['en', 'he', 'ar', 'ru'],
  extract: {
    input: [
      'app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}',
      'lib/**/*.{ts,tsx}', 'services/**/*.{ts,tsx}', 'stores/**/*.{ts,tsx}',
      'utils/**/*.{ts,tsx}', 'contexts/**/*.{ts,tsx}', 'widgets/**/*.{ts,tsx}',
      '!**/*.stories.tsx', '!**/__tests__/**',
    ],
    output: 'locales/{{language}}/{{namespace}}.json',
    primaryLanguage: 'en',
    secondaryLanguages: ['he', 'ar', 'ru'],
    defaultNS: 'common',
    functions: ['t', '*.t', 'tCommon', 'tPair', 'tSearch', 'tTerminal'],
  },
}

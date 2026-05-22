module.exports = {
  extends: 'expo',
  root: true,
  plugins: ['i18next'],
  rules: {
    'i18next/no-literal-string': ['error', {
      markupOnly: true,
      ignoreAttribute: ['testID', 'accessibilityRole', 'style', 'className'],
    }],
  },
  overrides: [
    {
      files: ['__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'test-utils/**/*.{ts,tsx}'],
      rules: {
        'i18next/no-literal-string': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'react/display-name': 'off',
      },
    },
  ],
}

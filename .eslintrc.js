module.exports = {
  extends: 'expo',
  root: true,
  plugins: ['i18next'],
  rules: {
    'i18next/no-literal-string': ['error', {
      markupOnly: false,
      ignoreAttribute: ['testID', 'accessibilityRole', 'style', 'className', 'accessibilityLabel', 'color', 'size', 'weight', 'name', 'type', 'key', 'id', 'source'],
      ignoreCallee: ['require', 'console.log', 'console.warn', 'console.error', 'console.info', 'console.debug'],
      ignoredFiles: ['**/*.test.{ts,tsx}', '__tests__/**/*.{ts,tsx}', 'test-utils/**/*.{ts,tsx}'],
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

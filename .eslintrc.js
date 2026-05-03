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
}

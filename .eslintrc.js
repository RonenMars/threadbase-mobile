module.exports = {
  extends: 'expo',
  root: true,
  plugins: ['i18next', 'react-native'],
  rules: {
    // AST-based i18n enforcement - prioritizes layout files
    'i18next/no-literal-string': ['error', {
      markupOnly: true,
      // AST parser checks these props across React Native components
      attributes: {
        Button: ['title'],
        TextInput: ['placeholder', 'label'],
        Header: ['title', 'subtitle'],
        AppBar: ['title', 'subtitle'],
        TouchableOpacity: [], // No text props by default
        TouchableHighlight: [],
        View: [],
        // Global wildcard - applies to all components
        '*': ['accessibilityLabel', 'accessibilityHint'],
      },
      // Ignore technical/layout string values (not user-facing text)
      ignoreAttribute: [
        'testID',
        'accessibilityRole',
        'style',
        'className',
        'color',
        'size',
        'weight',
        'name',
        'type',
        'key',
        'id',
        'source',
        'flex',
        'flexDirection',
        'justifyContent',
        'alignItems',
        'position',
        'display',
        'direction',
        'textAlign',
        'fontWeight',
        'fontSize',
        'lineHeight',
        'resizeMode',
        'contentFit',
        'iconName', // Phosphor icon names
        'icon',
        'variant',
        'theme',
        'mode',
      ],
      ignoreCallee: [
        'require',
        'console.log',
        'console.warn',
        'console.error',
        'console.info',
        'console.debug',
        'clsx',
        'StyleSheet.create',
        'Animated.timing',
      ],
      ignoredFiles: ['**/*.test.{ts,tsx}', '__tests__/**/*.{ts,tsx}', 'test-utils/**/*.{ts,tsx}'],
    }],
    // Catch raw text children in <Text> nodes
    'react-native/no-raw-text': ['error', {
      skip: ['CustomText'], // If you have custom text wrappers
    }],
  },
  overrides: [
    {
      files: ['__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', 'test-utils/**/*.{ts,tsx}'],
      rules: {
        'i18next/no-literal-string': 'off',
        'react-native/no-raw-text': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'react/display-name': 'off',
      },
    },
  ],
}

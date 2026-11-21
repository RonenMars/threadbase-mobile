const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const { withNativewind } = require('nativewind/metro')

// getSentryExpoConfig wraps Expo's default Metro config to emit the debug-id
// needed for Sentry source-map upload. It is a drop-in for getDefaultConfig and
// has no runtime effect when Sentry is disabled/unconfigured.
const config = withNativewind(getSentryExpoConfig(__dirname))

// TB_DEV_BIG_TEXT=1 swaps React Native's Text and TextInput for wrappers that add 3pt and step
// every weight up, and Phosphor's shared icon base for one that scales every icon, for marketing
// screenshots. Resolving at this level also reaches Animated.Text, which imports Text by path.
// No store or QA pipeline sets the variable.
if (process.env.TB_DEV_BIG_TEXT === '1') {
  const path = require('path')
  /* eslint-disable i18next/no-literal-string -- module paths, not UI copy */
  const swaps = [
    ['react-native/Libraries/Text/Text', 'Text.tsx'],
    ['react-native/Libraries/Components/TextInput/TextInput', 'TextInput.tsx'],
    ['phosphor-react-native/lib/module/lib/icon-base', 'IconBase.tsx'],
  ]
  const resolvedSwaps = swaps.map(([from, to]) => [
    path.join(`${from}.js`),
    path.join(__dirname, 'services/dev-big-text', to),
  ])
  const fromWrapper = (context, moduleName) =>
    swaps.some(([from]) => from === moduleName) && resolvedSwaps.some(([, to]) => context.originModulePath === to)
  /* eslint-enable i18next/no-literal-string */
  const inner = config.resolver.resolveRequest
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // A wrapper's own import of the component it replaces skips the chain: react-native-css would
    // otherwise send Text to its className Text, which imports react-native's Text, which is this
    // wrapper again.
    if (fromWrapper(context, moduleName)) return context.resolveRequest(context, moduleName, platform)
    const resolved = inner(context, moduleName, platform)
    const swap = resolved.type === 'sourceFile' && resolvedSwaps.find(([from]) => resolved.filePath.endsWith(from))
    return swap ? { type: 'sourceFile', filePath: swap[1] } : resolved
  }
  console.log('TB_DEV_BIG_TEXT=1: bundling enlarged Text, TextInput and icons')
}

module.exports = config

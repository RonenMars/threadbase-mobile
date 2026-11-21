const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const { withNativewind } = require('nativewind/metro')

// getSentryExpoConfig wraps Expo's default Metro config to emit the debug-id
// needed for Sentry source-map upload. It is a drop-in for getDefaultConfig and
// has no runtime effect when Sentry is disabled/unconfigured.
const config = withNativewind(getSentryExpoConfig(__dirname))

// TB_DEV_BIG_TEXT=1 swaps React Native's Text and TextInput for wrappers that add 3pt and step
// every weight up, for marketing screenshots. Resolving at this level also reaches Animated.Text,
// which imports Text by path. No store or QA pipeline sets the variable.
if (process.env.TB_DEV_BIG_TEXT === '1') {
  const path = require('path')
  /* eslint-disable i18next/no-literal-string -- module paths, not UI copy */
  const swaps = [
    ['Libraries/Text/Text.js', 'services/dev-big-text/Text.tsx'],
    ['Libraries/Components/TextInput/TextInput.js', 'services/dev-big-text/TextInput.tsx'],
  ].map(([from, to]) => [path.join('react-native', from), path.join(__dirname, to)])
  const fromWrapper = (context, moduleName) =>
    moduleName.startsWith('react-native/Libraries/') && swaps.some(([, to]) => context.originModulePath === to)
  /* eslint-enable i18next/no-literal-string */
  const inner = config.resolver.resolveRequest
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // The wrapper's own import of the RN component skips the chain: react-native-css would
    // otherwise send it to its className Text, which imports react-native's Text, which is this
    // wrapper again.
    if (fromWrapper(context, moduleName)) return context.resolveRequest(context, moduleName, platform)
    const resolved = inner(context, moduleName, platform)
    const swap = resolved.type === 'sourceFile' && swaps.find(([from]) => resolved.filePath.endsWith(from))
    return swap ? { type: 'sourceFile', filePath: swap[1] } : resolved
  }
  console.log('TB_DEV_BIG_TEXT=1: bundling enlarged Text and TextInput')
}

module.exports = config

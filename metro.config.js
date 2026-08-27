const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const { withNativewind } = require('nativewind/metro')

// getSentryExpoConfig wraps Expo's default Metro config to emit the debug-id
// needed for Sentry source-map upload. It is a drop-in for getDefaultConfig and
// has no runtime effect when Sentry is disabled/unconfigured.
const config = getSentryExpoConfig(__dirname)

module.exports = withNativewind(config)

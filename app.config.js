'use strict'

const SENTRY_PLUGIN = '@sentry/react-native/expo'

/**
 * The Sentry Expo plugin warns unless `organization` / `project` are plugin
 * props. It does not read `SENTRY_ORG` / `SENTRY_PROJECT` until the later
 * native source-map upload, so a local `.env` would otherwise never clear
 * the warning.
 */
function applySentryPluginEnv(config) {
  const organization =
    typeof process.env.SENTRY_ORG === 'string' ? process.env.SENTRY_ORG.trim() : ''
  const project =
    typeof process.env.SENTRY_PROJECT === 'string' ? process.env.SENTRY_PROJECT.trim() : ''
  if (!organization || !project || !Array.isArray(config.plugins)) {
    return config
  }

  return {
    ...config,
    plugins: config.plugins.map((plugin) => {
      if (plugin !== SENTRY_PLUGIN) return plugin
      return [SENTRY_PLUGIN, { organization, project }]
    }),
  }
}

module.exports = ({ config }) => applySentryPluginEnv(config)

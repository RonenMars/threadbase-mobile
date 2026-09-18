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

/**
 * app.config.js is the one place every local run command passes through
 * (`expo start`, `expo run:ios`, `expo run:android`, `expo prebuild`, and the
 * dev-tunnel/dev-device scripts that shell out to them), so it's the shared
 * choke point for warning about a QA flag left on in an incomplete shell.
 *
 * EXPO_PUBLIC_SENTRY_DSN and EXPO_PUBLIC_SENTRY_ALLOW_DEV are the only two
 * vars that gate whether a __DEV__ session can transmit at all
 * (environmentPermitsReporting() in services/sentry.ts) — without them the
 * QA-forced consent UI renders but every toggle is a no-op.
 */
function warnIfQaFlagIncomplete() {
  if (process.env.EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI !== '1') return

  const missing = []
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) missing.push('EXPO_PUBLIC_SENTRY_DSN')
  if (process.env.EXPO_PUBLIC_SENTRY_ALLOW_DEV !== '1') missing.push('EXPO_PUBLIC_SENTRY_ALLOW_DEV=1')
  if (missing.length === 0) return

  const title = '⚠  QA DIAGNOSTICS-CONSENT UI OVERRIDE IS ON  ⚠'
  const body = [
    'EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI=1 is set, but this shell',
    'is missing the Sentry env vars needed to exercise it end to end:',
    '',
    ...missing.map((v) => `    ✗ ${v}`),
    '',
    'The consent UI will render, but Sentry will not transmit anything —',
    "you'd be testing a UI with no observable effect.",
  ]
  const width = Math.max(title.length, ...body.map((l) => l.length)) + 4
  const top = `╔${'═'.repeat(width - 2)}╗`
  const divider = `╠${'═'.repeat(width - 2)}╣`
  const bottom = `╚${'═'.repeat(width - 2)}╝`
  const pad = (l, c = ' ') => `║${c}${l.padEnd(width - 3, c)}║`
  const center = (l) => {
    const left = Math.floor((width - 2 - l.length) / 2)
    return `║${' '.repeat(left)}${l}${' '.repeat(width - 2 - left - l.length)}║`
  }
  const banner = [top, center(title), divider, ...body.map((l) => pad(l)), bottom].join('\n')
  const yellow = (s) => `\x1b[1;33m${s}\x1b[0m`
  // eslint-disable-next-line no-console
  console.warn(yellow(banner))
}

module.exports = ({ config }) => {
  warnIfQaFlagIncomplete()
  return applySentryPluginEnv(config)
}

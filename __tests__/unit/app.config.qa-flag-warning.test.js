const path = require('path')

const CONFIG_PATH = path.resolve(__dirname, '../../app.config.js')

function loadConfig(env) {
  const prev = { ...process.env }
  Object.assign(process.env, env)
  const warn = jest.fn()
  const prevWarn = console.warn
  console.warn = warn
  jest.resetModules()
  try {
    require(CONFIG_PATH)({ config: { plugins: [] } })
  } finally {
    console.warn = prevWarn
    process.env = prev
  }
  return warn
}

// app.config.js runs on every local run command (expo start / run:ios / run:android
// / prebuild), so it's the one place that can warn a QA session the flag will render
// UI with no observable Sentry effect.
describe('app.config.js — QA diagnostics-consent flag warning', () => {
  it('warns when the flag is on but both Sentry vars are missing', () => {
    const warn = loadConfig({ EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI: '1' })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('EXPO_PUBLIC_SENTRY_DSN')
    expect(warn.mock.calls[0][0]).toContain('EXPO_PUBLIC_SENTRY_ALLOW_DEV=1')
  })

  it('warns naming only the specific var still missing', () => {
    const warn = loadConfig({
      EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI: '1',
      EXPO_PUBLIC_SENTRY_DSN: 'https://key@o0.ingest.sentry.io/0',
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).not.toContain('EXPO_PUBLIC_SENTRY_DSN\n')
    expect(warn.mock.calls[0][0]).toContain('EXPO_PUBLIC_SENTRY_ALLOW_DEV=1')
  })

  it('stays silent when the flag is on and both Sentry vars are set', () => {
    const warn = loadConfig({
      EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI: '1',
      EXPO_PUBLIC_SENTRY_DSN: 'https://key@o0.ingest.sentry.io/0',
      EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1',
    })
    expect(warn).not.toHaveBeenCalled()
  })

  it('stays silent when the flag is off, regardless of Sentry vars', () => {
    const warn = loadConfig({ EXPO_PUBLIC_QA_FORCE_DIAGNOSTICS_CONSENT_UI: '0' })
    expect(warn).not.toHaveBeenCalled()
  })
})

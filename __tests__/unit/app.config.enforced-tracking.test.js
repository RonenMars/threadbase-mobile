const path = require('path')

const CONFIG_PATH = path.resolve(__dirname, '../../app.config.js')
const ALL = {
  EXPO_PUBLIC_SENTRY_DSN: 'https://key@o0.ingest.sentry.io/0',
  SENTRY_AUTH_TOKEN: 'token',
  SENTRY_ORG: 'org',
  SENTRY_PROJECT: 'project',
}

function call(env) {
  const prev = { ...process.env }
  for (const key of ['EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING', ...Object.keys(ALL)]) delete process.env[key]
  Object.assign(process.env, env)
  jest.resetModules()
  try {
    require(CONFIG_PATH)({ config: { plugins: [] } })
    return null
  } catch (err) {
    return err
  } finally {
    process.env = prev
  }
}

describe('app.config.js — enforced Sentry tracking requires every Sentry variable', () => {
  it.each(['1', 'true', 'TRUE'])('stops the run when the flag is %s and the DSN is missing', (flag) => {
    const { EXPO_PUBLIC_SENTRY_DSN: _dsn, ...rest } = ALL
    const err = call({ EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING: flag, ...rest })
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toContain('EXPO_PUBLIC_SENTRY_DSN')
    expect(err.message).not.toContain('SENTRY_AUTH_TOKEN')
  })

  it('names every missing build credential', () => {
    const err = call({ EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING: '1', EXPO_PUBLIC_SENTRY_DSN: ALL.EXPO_PUBLIC_SENTRY_DSN })
    expect(err.message).toContain('SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT')
  })

  it('treats a blank value as missing', () => {
    const err = call({ EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING: '1', ...ALL, SENTRY_ORG: '  ' })
    expect(err.message).toContain('SENTRY_ORG')
  })

  it('passes with the flag and all four variables', () => {
    expect(call({ EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING: 'true', ...ALL })).toBeNull()
  })

  it.each([undefined, '0', 'false'])('does not check anything when the flag is %s', (flag) => {
    expect(call(flag === undefined ? {} : { EXPO_PUBLIC_ENFORCE_SENTRY_TRACKING: flag })).toBeNull()
  })
})

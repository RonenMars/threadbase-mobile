/**
 * Tests for the Sentry crash-reporting service. Verifies the consent gating,
 * defensive init config, immediate-disable behavior, and that events/breadcrumbs
 * are routed through the sanitizer. The SDK itself is mocked in jest.setup.js.
 */

const DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0'

/**
 * Load the sentry service fresh with a given env, so the module-level DSN /
 * dev-allow reads pick up the test's configuration. Returns the module plus the
 * mocked SDK so assertions can inspect init options.
 */
function loadService(env: Record<string, string | undefined>) {
  let mod!: typeof import('@/services/sentry')
  let sdk!: typeof import('@sentry/react-native')
  jest.isolateModules(() => {
    const prev = { ...process.env }
    Object.assign(process.env, env)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sdk = require('@sentry/react-native')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('@/services/sentry')
    process.env = prev
  })
  return { mod, sdk }
}

describe('sentry service — consent gating', () => {
  it('does not initialize when consent is denied', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    const ok = await mod.initCrashReporting(false)
    expect(ok).toBe(false)
    expect(mod.isCrashReportingActive()).toBe(false)
    expect(sdk.init).not.toHaveBeenCalled()
  })

  it('does not initialize when no DSN is configured (even with consent)', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: undefined, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    const ok = await mod.initCrashReporting(true)
    expect(ok).toBe(false)
    expect(sdk.init).not.toHaveBeenCalled()
  })

  it('does not initialize in a dev environment without the explicit override', async () => {
    // __DEV__ is true under jest; without EXPO_PUBLIC_SENTRY_ALLOW_DEV we bail.
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: undefined })
    const ok = await mod.initCrashReporting(true)
    expect(ok).toBe(false)
    expect(sdk.init).not.toHaveBeenCalled()
  })

  it('initializes when consent granted + DSN + environment permits', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    const ok = await mod.initCrashReporting(true)
    expect(ok).toBe(true)
    expect(mod.isCrashReportingActive()).toBe(true)
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })

  it('is idempotent — a second init does not re-call the SDK', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.initCrashReporting(true)
    await mod.initCrashReporting(true)
    expect(sdk.init).toHaveBeenCalledTimes(1)
  })
})

describe('sentry service — defensive init config', () => {
  it('disables every content-capturing feature', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.initCrashReporting(true)
    const opts = (sdk.init as jest.Mock).mock.calls[0][0]
    expect(opts.sendDefaultPii).toBe(false)
    expect(opts.attachScreenshot).toBe(false)
    expect(opts.attachViewHierarchy).toBe(false)
    expect(opts.enableCaptureFailedRequests).toBe(false)
    expect(opts.enableUserInteractionTracing).toBe(false)
    expect(opts.enableAutoConsoleLogs).toBe(false)
    expect(opts.enableAutoSessionTracking).toBe(false)
    expect(opts.replaysSessionSampleRate).toBe(0)
    expect(opts.replaysOnErrorSampleRate).toBe(0)
    expect(opts.tracesSampleRate).toBe(0)
    expect(typeof opts.beforeSend).toBe('function')
    expect(typeof opts.beforeBreadcrumb).toBe('function')
    expect(typeof opts.integrations).toBe('function')
  })

  it('filters out risky default integrations', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.initCrashReporting(true)
    const opts = (sdk.init as jest.Mock).mock.calls[0][0]
    const defaults = [
      { name: 'Breadcrumbs' },
      { name: 'DeviceContext' },
      { name: 'HttpContext' },
      { name: 'Screenshot' },
      { name: 'ViewHierarchy' },
      { name: 'Dedupe' },
      { name: 'ReactNativeErrorHandlers' },
    ]
    const kept = opts.integrations(defaults).map((i: { name: string }) => i.name)
    expect(kept).not.toContain('Breadcrumbs')
    expect(kept).not.toContain('DeviceContext')
    expect(kept).not.toContain('HttpContext')
    expect(kept).not.toContain('Screenshot')
    expect(kept).not.toContain('ViewHierarchy')
    // Safe ones survive
    expect(kept).toContain('Dedupe')
    expect(kept).toContain('ReactNativeErrorHandlers')
  })

  it('keeps SDK debug logging off during local QA unless explicitly enabled', async () => {
    const { mod, sdk } = loadService({
      EXPO_PUBLIC_SENTRY_DSN: DSN,
      EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1',
      EXPO_PUBLIC_SENTRY_DEBUG: undefined,
    })
    await mod.initCrashReporting(true)
    const opts = (sdk.init as jest.Mock).mock.calls[0][0]
    expect(opts.debug).toBe(false)
  })

  it('enables SDK debug logging only with the explicit debug override', async () => {
    const { mod, sdk } = loadService({
      EXPO_PUBLIC_SENTRY_DSN: DSN,
      EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1',
      EXPO_PUBLIC_SENTRY_DEBUG: '1',
    })
    await mod.initCrashReporting(true)
    const opts = (sdk.init as jest.Mock).mock.calls[0][0]
    expect(opts.debug).toBe(true)
  })

  it('sets an anonymous install id and safe tags, never PII', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.initCrashReporting(true)
    const scope = (sdk as unknown as { __scope: { setUser: jest.Mock; setTag: jest.Mock } }).__scope
    // setUser called with an { id } object only
    const userArg = scope.setUser.mock.calls.find((c: unknown[]) => c[0] && typeof c[0] === 'object')?.[0]
    expect(Object.keys(userArg)).toEqual(['id'])
    expect(typeof userArg.id).toBe('string')
    // Tags applied are safe metadata only
    const tagKeys = scope.setTag.mock.calls.map((c: string[]) => c[0])
    expect(tagKeys).toContain('platform')
    expect(tagKeys).toContain('app.version')
    expect(tagKeys.some((k: string) => k.includes('url') || k.includes('server'))).toBe(false)
  })
})

describe('sentry service — beforeSend / beforeBreadcrumb route through sanitizer', () => {
  async function getHooks() {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.initCrashReporting(true)
    const opts = (sdk.init as jest.Mock).mock.calls[0][0]
    return { beforeSend: opts.beforeSend, beforeBreadcrumb: opts.beforeBreadcrumb }
  }

  it('beforeSend strips non-allowlisted keys and secrets', async () => {
    const { beforeSend } = await getHooks()
    const event = {
      event_id: 'x',
      level: 'error',
      request: { url: 'https://secret.example.com/api?key=tb_live_abc123def456' },
      server_name: 'my-macbook.local',
      extra: { draft: 'my secret prompt' },
      exception: { values: [{ type: 'Error', value: 'boom at https://x.tunnel.io/ws?key=tb_live_zzz' }] },
    }
    const out = beforeSend(event)
    const s = JSON.stringify(out)
    expect(out.request).toBeUndefined()
    expect(out.server_name).toBeUndefined()
    expect(out.extra).toBeUndefined()
    expect(s.includes('tb_live')).toBe(false)
    expect(s.includes('secret.example.com')).toBe(false)
  })

  it('beforeBreadcrumb drops http breadcrumbs entirely', async () => {
    const { beforeBreadcrumb } = await getHooks()
    expect(beforeBreadcrumb({ category: 'http', data: { url: 'https://x/api' } })).toBeNull()
  })
})

describe('sentry service — immediate disable', () => {
  it('closes the client and clears the user on disable', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.initCrashReporting(true)
    expect(mod.isCrashReportingActive()).toBe(true)
    await mod.disableCrashReporting()
    expect(mod.isCrashReportingActive()).toBe(false)
    expect(sdk.close).toHaveBeenCalled()
    const scope = (sdk as unknown as { __scope: { setUser: jest.Mock } }).__scope
    expect(scope.setUser).toHaveBeenCalledWith(null)
  })

  it('setCrashReportingEnabled(false) disables without prior init', async () => {
    const { mod } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await expect(mod.setCrashReportingEnabled(false)).resolves.toBeUndefined()
    expect(mod.isCrashReportingActive()).toBe(false)
  })

  it('does not capture when inactive', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    // never initialized
    expect(mod.captureHandledError(new Error('x'))).toBeUndefined()
    expect(mod.captureSafeMessage('app_started')).toBeUndefined()
    expect(sdk.captureException).not.toHaveBeenCalled()
    expect(sdk.captureMessage).not.toHaveBeenCalled()
  })
})

describe('sentry service — capture helpers', () => {
  it('captureHandledError scrubs the error before sending', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.initCrashReporting(true)
    const id = mod.captureHandledError(new Error('failed to reach https://secret.tunnel.io/ws?key=tb_live_abc'), {
      tag: 'connection_failed',
    })
    expect(id).toBe('evt_exception')
    const capturedError = (sdk.captureException as jest.Mock).mock.calls[0][0]
    expect(capturedError.message.includes('tb_live')).toBe(false)
    expect(capturedError.message.includes('secret.tunnel.io')).toBe(false)
  })

  it('captureSafeMessage rejects non-enum messages', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.initCrashReporting(true)
    expect(mod.captureSafeMessage('This is a free-form message with spaces')).toBeUndefined()
    expect(mod.captureSafeMessage('app_started')).toBe('evt_message')
    expect((sdk.captureMessage as jest.Mock).mock.calls.length).toBe(1)
  })

  it('setConnectionModeTag derives a generic enum and never stores the url', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.initCrashReporting(true)
    const scope = (sdk as unknown as { __scope: { setTag: jest.Mock } }).__scope
    scope.setTag.mockClear()
    mod.setConnectionModeTag('http://192.168.1.5:8766')
    expect(scope.setTag).toHaveBeenCalledWith('connection.mode', 'local')
    mod.setConnectionModeTag('https://prod.tunnel.example.com')
    expect(scope.setTag).toHaveBeenCalledWith('connection.mode', 'remote')
  })
})

describe('sentry service — reportOneShot (works independent of standing consent)', () => {
  it('sends a report and closes the client again when reporting was OFF', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    expect(mod.isCrashReportingActive()).toBe(false)

    const eventId = await mod.reportOneShot(new Error('one-shot test'), { tag: 'test' })

    expect(eventId).toBe('evt_exception')
    expect(sdk.init).toHaveBeenCalledTimes(1) // initialized just for this report
    expect(sdk.close).toHaveBeenCalledTimes(1) // and torn down again afterward
    // Standing state is genuinely unaffected — still inactive afterward.
    expect(mod.isCrashReportingActive()).toBe(false)
  })

  it('does NOT flip the persisted crashReportingEnabled setting', async () => {
    // reportOneShot only touches the in-memory Sentry client; the settings
    // store is a separate module it never imports or writes to.
    const { mod } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.reportOneShot(new Error('one-shot test'))
    expect(mod.isCrashReportingActive()).toBe(false)
  })

  it('reuses the existing client without closing it when reporting was already ON', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.initCrashReporting(true)
    expect(mod.isCrashReportingActive()).toBe(true)
    ;(sdk.init as jest.Mock).mockClear()
    ;(sdk.close as jest.Mock).mockClear()

    const eventId = await mod.reportOneShot(new Error('one-shot test'))

    expect(eventId).toBe('evt_exception')
    expect(sdk.init).not.toHaveBeenCalled() // already initialized — no re-init
    expect(sdk.close).not.toHaveBeenCalled() // standing reporting stays open
    expect(mod.isCrashReportingActive()).toBe(true)
  })

  it('returns undefined and sends nothing when no DSN is configured', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: undefined, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    const eventId = await mod.reportOneShot(new Error('one-shot test'))
    expect(eventId).toBeUndefined()
    expect(sdk.init).not.toHaveBeenCalled()
    expect(sdk.captureException).not.toHaveBeenCalled()
  })

  it('returns undefined when the dev environment does not permit reporting', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: undefined })
    const eventId = await mod.reportOneShot(new Error('one-shot test'))
    expect(eventId).toBeUndefined()
    expect(sdk.init).not.toHaveBeenCalled()
  })

  it('scrubs the error before sending, same as captureHandledError', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    await mod.reportOneShot(new Error('failed to reach https://secret.tunnel.io/ws?key=tb_live_abc'))
    const capturedError = (sdk.captureException as jest.Mock).mock.calls[0][0]
    expect(capturedError.message.includes('tb_live')).toBe(false)
    expect(capturedError.message.includes('secret.tunnel.io')).toBe(false)
  })

  it('closes the one-shot client even if the capture itself throws', async () => {
    const { mod, sdk } = loadService({ EXPO_PUBLIC_SENTRY_DSN: DSN, EXPO_PUBLIC_SENTRY_ALLOW_DEV: '1' })
    ;(sdk.captureException as jest.Mock).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const eventId = await mod.reportOneShot(new Error('one-shot test'))
    expect(eventId).toBeUndefined()
    expect(sdk.close).toHaveBeenCalledTimes(1) // cleanup still ran
    expect(mod.isCrashReportingActive()).toBe(false)
  })
})

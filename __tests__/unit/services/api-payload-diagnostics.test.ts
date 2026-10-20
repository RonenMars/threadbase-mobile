import { apiRouteTemplate } from '@/services/api-route-template'
import { readApiJson } from '@/services/api-payload-diagnostics'
import { isApiPayloadDiagnosticsEnabled, logApiPayload } from '@/services/sentry'

jest.mock('@/services/sentry', () => ({
  isApiPayloadDiagnosticsEnabled: jest.fn(() => true),
  logApiPayload: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(isApiPayloadDiagnosticsEnabled).mockReturnValue(true)
})

it('replaces resource identifiers and strips all query data', () => {
  expect(apiRouteTemplate('/api/conversations/private-id?search=private')).toBe('/api/conversations/:id')
  expect(apiRouteTemplate('/api/sessions/private-id')).toBe('/api/sessions/:id')
  expect(apiRouteTemplate('/api/conversations/count')).toBe('/api/conversations/count')
  expect(apiRouteTemplate('https://private.example/api/conversations/private-id')).toBeUndefined()
  expect(apiRouteTemplate('/api/unknown/private')).toBeUndefined()
})

it('measures the original UTF-8 JSON body without emitting its contents', async () => {
  const text = '{ "text": "שלום" }\n'
  const response = { text: jest.fn().mockResolvedValue(text) } as unknown as Response
  expect(await readApiJson(response, '/api/conversations/private?query=secret')).toEqual({ text: 'שלום' })
  expect(logApiPayload).toHaveBeenCalledWith('/api/conversations/:id', new TextEncoder().encode(text).byteLength)
})

it('keeps the existing JSON path when consent is off', async () => {
  jest.mocked(isApiPayloadDiagnosticsEnabled).mockReturnValue(false)
  const response = { json: jest.fn().mockResolvedValue({ ok: true }) } as unknown as Response
  expect(await readApiJson(response, '/api/info')).toEqual({ ok: true })
  expect(logApiPayload).not.toHaveBeenCalled()
})

it('drops a response if consent is revoked while reading it', async () => {
  const response = { text: jest.fn(async () => {
    jest.mocked(isApiPayloadDiagnosticsEnabled).mockReturnValue(false)
    return '{}'
  }) } as unknown as Response
  await readApiJson(response, '/api/info')
  expect(logApiPayload).not.toHaveBeenCalled()
})

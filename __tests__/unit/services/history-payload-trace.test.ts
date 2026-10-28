import { traceHistoryPayload } from '@/services/history-payload-trace'
import { isHistoryPayloadTracingEnabled, logHistoryPayload } from '@/services/sentry'

jest.mock('@/services/sentry', () => ({
  isHistoryPayloadTracingEnabled: jest.fn(() => true),
  logHistoryPayload: jest.fn(),
}))

const byteSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(isHistoryPayloadTracingEnabled).mockReturnValue(true)
})

it('measures UTF-8 JSON and content categories without logging content or identifiers', () => {
  const page = {
    id: 'private-conversation',
    messages: [{ text: 'שלום', content: [
      { type: 'tool_use', input: { command: 'private command' } },
      { type: 'tool_result', content: 'private output' },
      { type: 'thinking', thinking: 'private reasoning' },
      { type: 'diff', hunks: ['private diff'] },
    ] }],
    message_pagination: { total: 100, has_more_older: true },
  }
  traceHistoryPayload(page, { status: 200, before_index: 80, cached_pages: 1 })
  const fields = jest.mocked(logHistoryPayload).mock.calls[0][0]
  expect(fields).toMatchObject({
    response_json_bytes: byteSize(page), returned_messages: 1, total_messages: 100,
    text_json_bytes: byteSize('שלום'), tool_result_json_bytes: byteSize('private output'),
    tool_input_json_bytes: byteSize({ command: 'private command' }),
    thinking_json_bytes: byteSize('private reasoning'), diff_json_bytes: byteSize(['private diff']),
    before_index: 80, cached_pages: 1, has_more_older: 1,
  })
  expect(Object.values(fields).every(value => typeof value === 'number')).toBe(true)
})

it('does not serialize payloads while disabled', () => {
  jest.mocked(isHistoryPayloadTracingEnabled).mockReturnValue(false)
  const toJSON = jest.fn(() => { throw new Error('should not serialize') })
  traceHistoryPayload({ toJSON }, { status: 200 })
  expect(toJSON).not.toHaveBeenCalled()
  expect(logHistoryPayload).not.toHaveBeenCalled()
})

it('reports no response body bytes for a cached 304', () => {
  traceHistoryPayload({ messages: [{ text: 'cached' }] }, { status: 304 })
  expect(logHistoryPayload).toHaveBeenCalledWith(expect.objectContaining({ response_json_bytes: 0 }))
})

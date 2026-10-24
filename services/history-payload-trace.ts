import { isHistoryPayloadTracingEnabled, logHistoryPayload } from './sentry'

export { isHistoryPayloadTracingEnabled }

function object(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function bytes(value: unknown): number {
  const json = JSON.stringify(value)
  return json == null ? 0 : new TextEncoder().encode(json).byteLength
}

/** Counts serialized JSON bytes, never message content or identifiers. Not wire bytes. */
export function traceHistoryPayload(value: unknown, request: Record<string, number>): void {
  if (!isHistoryPayloadTracingEnabled()) return
  try {
    const page = object(value)
    const messages = Array.isArray(page.messages) ? page.messages : []
    const sizes = {
      text_json_bytes: 0,
      tool_input_json_bytes: 0,
      tool_result_json_bytes: 0,
      thinking_json_bytes: 0,
      diff_json_bytes: 0,
      largest_message_json_bytes: 0,
    }
    for (const value of messages) {
      const message = object(value)
      sizes.largest_message_json_bytes = Math.max(sizes.largest_message_json_bytes, bytes(message))
      sizes.text_json_bytes += bytes(message.text)
      if (!Array.isArray(message.content)) continue
      for (const value of message.content) {
        const block = object(value)
        if (block.type === 'text') sizes.text_json_bytes += bytes(block.text)
        if (block.type === 'tool_use') sizes.tool_input_json_bytes += bytes(block.input)
        if (block.type === 'tool_result') sizes.tool_result_json_bytes += bytes(block.content)
        if (block.type === 'thinking') sizes.thinking_json_bytes += bytes(block.thinking)
        if (block.type === 'diff') sizes.diff_json_bytes += bytes(block.hunks)
      }
    }
    const pagination = object(page.message_pagination)
    logHistoryPayload({
      ...request,
      // A 304 reuses cached data; these bytes describe that data, not a downloaded body.
      response_json_bytes: request.status === 304 ? 0 : bytes(page),
      returned_messages: messages.length,
      total_messages: typeof pagination.total === 'number' ? pagination.total : -1,
      has_more_older: pagination.has_more_older === true ? 1 : 0,
      has_more_newer: pagination.has_more_newer === true ? 1 : 0,
      ...sizes,
    })
  } catch {
    // A malformed response or unavailable encoder must not fail the request.
  }
}

import { isApiPayloadDiagnosticsEnabled, logApiPayload } from './sentry'

import { apiRouteTemplate } from './api-route-template'

/** Measures decoded response-body UTF-8 bytes, not compressed/encrypted transfer bytes. */
export async function readApiJson<T>(response: Response, path: string): Promise<T> {
  const route = apiRouteTemplate(path)
  if (!route || !isApiPayloadDiagnosticsEnabled()) return response.json() as Promise<T>
  const text = await response.text()
  const parsed = JSON.parse(text) as T
  // Recheck consent after the asynchronous read; a toggle may have changed it.
  if (isApiPayloadDiagnosticsEnabled()) {
    try {
      logApiPayload(route, new TextEncoder().encode(text).byteLength)
    } catch {
      // Measurement must never fail a successfully parsed API response.
    }
  }
  return parsed
}

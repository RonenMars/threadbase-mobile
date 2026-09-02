/**
 * Client-side HTTP(S) server URL checks used before dialing a pair exchange
 * or saving a manual server. Mirrors the scheme rules in pair-exchange but
 * returns a boolean so the UI can show an inline error without throwing.
 */
export function isValidHttpServerUrl(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (!parsed.hostname) return false
  return true
}

export function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url.replace(/^[a-z]+:\/\//i, '').split('/')[0] || url }
}

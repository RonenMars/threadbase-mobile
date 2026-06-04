import type { ServerConfig } from '@/types/api'

/**
 * Human-facing label for a server. Uses the user-provided `label` when set;
 * otherwise falls back to `host:port` parsed from the server URL so the user
 * can still identify which server is being referenced.
 *
 * The fallback exists because servers paired before the onboarding name slide
 * (Feature 23), or paired via "Skip", have no `label` — leaving Bug 28's
 * refresh modal with a blank "Refreshing " string.
 */
export function serverDisplayName(server: Pick<ServerConfig, 'label' | 'url'> | undefined | null): string {
  if (!server) return ''
  const label = server.label?.trim()
  if (label) return label
  return hostPortFromUrl(server.url)
}

function hostPortFromUrl(raw: string): string {
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
    return `${parsed.hostname}:${port}`
  } catch {
    // Last-ditch parse for malformed URLs — strip scheme + path, keep host:port.
    return raw.replace(/^[a-z]+:\/\//i, '').split('/')[0] || raw
  }
}

// Tracks whether the user has used a live session (sent input / keys / attach).
// Used by the session screen to discard unused sessions on back navigation
// (Bug 16 — abandoned empty sessions cluttering the hub).

const usedSessionIds = new Set<string>()

export function markSessionUsed(sessionId: string): void {
  if (!sessionId) return
  usedSessionIds.add(sessionId)
}

export function wasSessionUsed(sessionId: string): boolean {
  return usedSessionIds.has(sessionId)
}

export function clearSessionUsed(sessionId: string): void {
  usedSessionIds.delete(sessionId)
}

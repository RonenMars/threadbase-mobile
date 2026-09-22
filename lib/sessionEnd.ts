// There is no capability flag for these on the wire: /kill shipped in 1.94.0,
// ?when=idle in 1.95.0 and ?delete in 1.96.0. A server that predates when=idle
// treats it as a plain /stop and interrupts the very turn the user asked to let
// finish, so every new action waits for the newest of the three.
const MIN_VERSION = [1, 96, 0]

export function supportsSessionEndActions(version: string | null | undefined): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? '')
  if (!match) return false
  const parts = match.slice(1).map(Number)
  for (let i = 0; i < MIN_VERSION.length; i += 1) {
    if (parts[i] !== MIN_VERSION[i]) return parts[i] > MIN_VERSION[i]
  }
  return true
}

export function sessionEndKey(serverId: string, sessionId: string): string {
  return `${serverId}:${sessionId}`
}

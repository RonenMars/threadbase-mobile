/**
 * Paths that appear under more than one server — used to force server chips
 * so duplicate projects stay disambiguated in multi-server hubs.
 */
export function collidingProjectPaths(
  items: readonly { projectPath?: string | null; serverId: string }[],
): Set<string> {
  const serversByPath = new Map<string, Set<string>>()
  for (const item of items) {
    const path = item.projectPath?.trim()
    if (!path) continue
    let servers = serversByPath.get(path)
    if (!servers) {
      servers = new Set()
      serversByPath.set(path, servers)
    }
    servers.add(item.serverId)
  }
  const colliding = new Set<string>()
  for (const [path, servers] of serversByPath) {
    if (servers.size > 1) colliding.add(path)
  }
  return colliding
}

export function shouldForceServerChip(
  projectPath: string | null | undefined,
  colliding: Set<string>,
): boolean {
  const path = projectPath?.trim()
  return Boolean(path && colliding.has(path))
}

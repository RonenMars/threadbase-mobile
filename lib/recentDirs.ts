import { basename } from '@/components/sessions/shared/pathTail'

export interface RecentDirEntry {
  path: string
  name: string
  lastUsedAt: string
}

export interface RawRecentDir {
  path?: string
  lastUsedAt?: string
}

export interface RawRecentDirsResponse {
  dirs?: RawRecentDir[]
}

interface SessionLike {
  serverId: string
  projectPath?: string | null
  startedAt?: string | null
}

function canonical(path: string): string {
  return path.trim().replace(/[\\/]+$/, '')
}

/** A row this build does not understand is skipped, never thrown on. */
export function parseRecentDirs(raw: RawRecentDirsResponse | null | undefined): RecentDirEntry[] {
  const rows = Array.isArray(raw?.dirs) ? raw.dirs : []
  const out: RecentDirEntry[] = []
  for (const row of rows) {
    if (typeof row?.path !== 'string' || !canonical(row.path)) continue
    const path = canonical(row.path)
    out.push({
      path,
      name: basename(path) ?? path,
      lastUsedAt: typeof row.lastUsedAt === 'string' ? row.lastUsedAt : '',
    })
  }
  return out
}

/**
 * The server's recorded list, plus any directory of this server's sessions
 * that is newer — a session started since the list was fetched shows up
 * without waiting for a refetch. Newest first, one entry per path.
 */
export function mergeRecentDirs(
  recorded: RecentDirEntry[],
  sessions: SessionLike[],
  serverId: string,
  max: number,
): RecentDirEntry[] {
  const fromSessions: RecentDirEntry[] = sessions
    .filter((s) => s.serverId === serverId && s.projectPath && canonical(s.projectPath))
    .map((s) => {
      const path = canonical(s.projectPath ?? '')
      return { path, name: basename(path) ?? path, lastUsedAt: s.startedAt ?? '' }
    })

  const byPath = new Map<string, RecentDirEntry>()
  for (const dir of [...recorded, ...fromSessions]) {
    const existing = byPath.get(dir.path)
    if (!existing || dir.lastUsedAt.localeCompare(existing.lastUsedAt) > 0) byPath.set(dir.path, dir)
  }
  return [...byPath.values()]
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, max)
}

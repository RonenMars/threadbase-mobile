import { basename } from '@/components/sessions/shared/pathTail'
import { canonical } from '@/lib/recentDirs'

export interface PinnedDirEntry {
  path: string
  name: string
  /** The browse screen's own form ("" = root); null when outside the current root. */
  relativePath: string | null
}

interface RawPinnedDir {
  path?: string
  relativePath?: string | null
}

export interface RawPinnedDirsResponse {
  dirs?: RawPinnedDir[]
}

/** A row this build does not understand is skipped, never thrown on. */
export function parsePinnedDirs(raw: RawPinnedDirsResponse | null | undefined): PinnedDirEntry[] {
  const rows = Array.isArray(raw?.dirs) ? raw.dirs : []
  const out: PinnedDirEntry[] = []
  for (const row of rows) {
    if (typeof row?.path !== 'string' || !canonical(row.path)) continue
    const path = canonical(row.path)
    out.push({
      path,
      name: basename(path) ?? path,
      relativePath: typeof row.relativePath === 'string' ? row.relativePath : null,
    })
  }
  return out
}

/** Whether the folder the browse screen shows (root-relative or absolute) is pinned. */
export function findPinnedDir(dirs: PinnedDirEntry[], currentPath: string): PinnedDirEntry | undefined {
  const current = canonical(currentPath)
  return dirs.find((d) => d.relativePath === current || d.path === current)
}

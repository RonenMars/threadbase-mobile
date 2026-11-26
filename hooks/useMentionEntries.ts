import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { browseQueryKey, fetchBrowse } from '@/hooks/useBrowse'
import { createApiForServer, NetworkError, NotFoundError } from '@/services/api-client'
import { useServersStore } from '@/stores/servers'
import type { BrowseResponse } from '@/types/api'
import { extraDirEntries, rankMentionEntries, type MentionEntry } from '@/lib/mentionToken'

export type MentionListState =
  | { status: 'loading' }
  | { status: 'ready'; entries: MentionEntry[] }
  /** The server will not list this folder (outside its browse root, browsing off, or no capability). */
  | { status: 'unsupported' }
  | { status: 'error' }

const DIR_DEBOUNCE_MS = 150
const LISTING_STALE_MS = 30_000

/**
 * The browse API takes a path under the server's browse root and the session
 * gives an absolute cwd. A POSIX streamer accepts an absolute path inside its
 * root as-is; a Windows one always strips the leading separator, so there is
 * no path we can send for it and the picker reports itself unsupported.
 */
export function mentionListingPath(projectPath: string, dir: string): string | null {
  if (dir === '~' || dir.startsWith('~/')) return dir
  if (!projectPath.startsWith('/')) return null
  const base = projectPath.replace(/\/+$/, '')
  if (!dir) return base || '/'
  return `${base}/${dir}`
}

function fetchSessionFiles(serverId: string, sessionId: string, dir: string): Promise<BrowseResponse> {
  return createApiForServer(serverId).get<BrowseResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/files?dir=${encodeURIComponent(dir)}`,
  )
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

export function useMentionEntries(
  serverId: string,
  projectPath: string,
  sessionId: string | undefined,
  dir: string,
  query: string,
  /** The session's extra directories; offered as folders at the top level. */
  extraDirs: readonly string[] = [],
): MentionListState {
  // Only /api/info's flag proves the server has the endpoint; absent reads as an older server.
  const serverHasSessionFiles = useServersStore((s) => s.servers[serverId]?.serverInfo?.sessionFiles === true)
  // Filtering within a directory is synchronous; only changing directory
  // fetches, and fast typing through `src/comp…` should not list every prefix.
  const debouncedDir = useDebounced(dir, DIR_DEBOUNCE_MS)
  // `~` is not relative to the cwd: the session endpoint would read it as a folder name, /api/browse expands it.
  const isHomeDir = debouncedDir === '~' || debouncedDir.startsWith('~/')
  const sessionRelative = serverHasSessionFiles && !!sessionId && !isHomeDir
  // The session-relative listing needs no absolute path, so it also serves a Windows streamer.
  const path = sessionRelative ? debouncedDir : mentionListingPath(projectPath, debouncedDir)

  const listing = useQuery({
    // The browse key is shared with the Browse screen, so the two share a cache.
    queryKey: sessionRelative
      ? ['session-files', serverId, sessionId, debouncedDir]
      : browseQueryKey(serverId, path ?? ''),
    queryFn: () =>
      sessionRelative && sessionId
        ? fetchSessionFiles(serverId, sessionId, debouncedDir)
        : fetchBrowse(serverId, path ?? ''),
    enabled: !!serverId && path !== null,
    staleTime: LISTING_STALE_MS,
    retry: false,
  })

  if (path === null) return { status: 'unsupported' }
  // Rows or an error from another directory would mislead; a tapped row would insert the wrong path.
  if (debouncedDir !== dir) return { status: 'loading' }
  if (listing.error) {
    // A folder typed by hand that does not exist simply has no matches.
    if (listing.error instanceof NotFoundError) return { status: 'ready', entries: [] }
    if (listing.error instanceof NetworkError && (listing.error.status === 400 || listing.error.status === 403)) {
      return { status: 'unsupported' }
    }
    return { status: 'error' }
  }
  if (!listing.data) return { status: 'loading' }

  const entries: MentionEntry[] = [
    ...listing.data.directories.map((d) => ({ name: d.name, kind: 'dir' as const })),
    // Older servers list directories only.
    ...(listing.data.files ?? []).map((f) => ({ name: f.name, kind: 'file' as const })),
  ]
  const extras = dir === '' ? extraDirEntries(projectPath, extraDirs, query) : []
  return { status: 'ready', entries: [...extras, ...rankMentionEntries(entries, query)] }
}

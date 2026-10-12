import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { browseQueryKey, fetchBrowse } from '@/hooks/useBrowse'
import { NetworkError, NotFoundError } from '@/services/api-client'
import { rankMentionEntries, type MentionEntry } from '@/lib/mentionToken'

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
  if (!projectPath.startsWith('/')) return null
  const base = projectPath.replace(/\/+$/, '')
  if (!dir) return base || '/'
  return `${base}/${dir}`
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
  dir: string,
  query: string,
): MentionListState {
  // Filtering within a directory is synchronous; only changing directory
  // fetches, and fast typing through `src/comp…` should not list every prefix.
  const debouncedDir = useDebounced(dir, DIR_DEBOUNCE_MS)
  const path = mentionListingPath(projectPath, debouncedDir)

  const listing = useQuery({
    // Same key as the Browse screen, so the two share a cache.
    queryKey: browseQueryKey(serverId, path ?? ''),
    queryFn: () => fetchBrowse(serverId, path ?? ''),
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
  return { status: 'ready', entries: rankMentionEntries(entries, query) }
}

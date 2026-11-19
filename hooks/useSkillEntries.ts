import { useQuery } from '@tanstack/react-query'
import { createApiForServer, NetworkError, NotFoundError } from '@/services/api-client'
import { rankSkills, type SkillEntry } from '@/lib/slashToken'

export type SkillListState =
  | { status: 'loading' }
  | { status: 'ready'; skills: SkillEntry[] }
  /** The server cannot list skills for this session (older server, other provider, or no capability). */
  | { status: 'unsupported' }
  | { status: 'error' }

export interface SkillsResponse {
  skills: SkillEntry[]
}

const SKILLS_STALE_MS = 30_000

export function fetchSkills(serverId: string, sessionId: string): Promise<SkillsResponse> {
  return createApiForServer(serverId).get<SkillsResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/skills`)
}

export function useSkillEntries(serverId: string, sessionId: string, query: string): SkillListState {
  // One fetch per session; typing after the `/` only filters.
  const listing = useQuery({
    queryKey: ['skills', serverId, sessionId],
    queryFn: () => fetchSkills(serverId, sessionId),
    enabled: !!serverId && !!sessionId,
    staleTime: SKILLS_STALE_MS,
    retry: false,
  })

  if (listing.error) {
    // The session is gone; there is nothing to offer.
    if (listing.error instanceof NotFoundError) return { status: 'ready', skills: [] }
    if (listing.error instanceof NetworkError && [400, 403, 501].includes(listing.error.status ?? 0)) {
      return { status: 'unsupported' }
    }
    return { status: 'error' }
  }
  if (!listing.data) return { status: 'loading' }
  return { status: 'ready', skills: rankSkills(listing.data.skills, query) }
}

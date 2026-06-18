import type { Session } from '@/types/api'

/** Returns the full Session snapshot from a resume 201 body, or null for the legacy {id} shape. */
export function normalizeResumeResponse(resp: Record<string, unknown>): Session | null {
  if (
    typeof resp.projectPath === 'string' &&
    typeof resp.projectName === 'string' &&
    typeof resp.startedAt === 'string'
  ) {
    return resp as unknown as Session
  }
  return null
}

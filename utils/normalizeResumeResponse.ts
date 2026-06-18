import type { Session } from '@/types/api'

/** Returns the full Session snapshot from a resume 201 body, or null for the legacy {id} shape. */
export function normalizeResumeResponse(resp: unknown): Session | null {
  if (
    typeof resp === 'object' &&
    resp !== null &&
    typeof (resp as Record<string, unknown>).projectPath === 'string' &&
    typeof (resp as Record<string, unknown>).projectName === 'string' &&
    typeof (resp as Record<string, unknown>).startedAt === 'string'
  ) {
    return resp as unknown as Session
  }
  return null
}

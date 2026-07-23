import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getClaudeFlags, updateClaudeFlags } from '@/services/api-client'
import type { ClaudeFlagsConfig, ClaudeFlagValues } from '@/types/api'

/**
 * Per-server Claude CLI flags, read from the server.
 *
 * Deliberately NOT persisted to disk (the key root is absent from
 * PERSISTED_QUERY_ROOTS in services/query-client.ts): these values live on the
 * streamer and can be changed from the CLI there, so a cached copy would show
 * the user a security setting the server no longer has.
 *
 * `null` data means the server predates the feature — callers hide the UI.
 */
export function useClaudeFlags(serverId: string) {
  return useQuery<ClaudeFlagsConfig | null>({
    queryKey: ['claudeFlags', serverId],
    queryFn: () => getClaudeFlags(serverId),
    enabled: !!serverId,
  })
}

/**
 * Replace the whole flag set.
 *
 * No optimistic update on purpose: this can turn Claude's permission prompts
 * off, and a write that silently rolls back would leave the user believing a
 * security setting took effect when it didn't. Callers show a spinner and wait.
 */
export function useUpdateClaudeFlags(serverId: string) {
  const qc = useQueryClient()
  return useMutation<
    ClaudeFlagsConfig,
    Error,
    { values: ClaudeFlagValues; extraArgs?: string }
  >({
    mutationFn: ({ values, extraArgs }) => updateClaudeFlags(serverId, values, extraArgs),
    onSuccess: (data) => {
      // Seed from the response rather than only invalidating: the server
      // normalises the values (dropping unknown ids), so its copy is authoritative.
      qc.setQueryData(['claudeFlags', serverId], data)
      qc.invalidateQueries({ queryKey: ['claudeFlags', serverId] })
    },
  })
}

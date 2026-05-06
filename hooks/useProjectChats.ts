// Unified ProjectChat list hook + query key factory + sort/dedupe helpers.
//
// All cache keys for the unified list are produced by `projectChatKeys`. UI
// components must NEVER hand-build keys with `projectPath`.

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listProjectChats } from '@/services/project-chats-api'
import { useServersStore } from '@/stores/servers'
import type { ProjectChat, ProjectChatType } from '@/types/projectChat'

// ── Query keys ──────────────────────────────────────────────────────────

export const projectChatKeys = {
  all: ['projectChats'] as const,
  list: (serverId: string) => [...projectChatKeys.all, serverId] as const,
  detail: (serverId: string, type: ProjectChatType, id: string) =>
    [...projectChatKeys.list(serverId), type, id] as const,
}

// ── Sort + dedupe helpers ───────────────────────────────────────────────

function getSortTime(item: ProjectChat): number {
  const value = item.latestMessageAt ?? item.updatedAt ?? item.createdAt
  return value ? new Date(value).getTime() : 0
}

/**
 * Defensive client sort. Backend should already return items sorted by
 * latestMessageAt desc; this guards against drift across multi-server merges.
 */
export function sortProjectChats(a: ProjectChat, b: ProjectChat): number {
  const diff = getSortTime(b) - getSortTime(a)
  if (diff !== 0) return diff
  return a.title.localeCompare(b.title)
}

/**
 * Defensive client dedupe: hide a conversation when a session in the same
 * list claims to have resumed from it. Backend remains the source of truth.
 */
export function dedupeProjectChats(items: ProjectChat[]): ProjectChat[] {
  const resumedConversationIds = new Set<string>()
  for (const item of items) {
    if (item.type === 'session' && item.resumedFromConversationId) {
      resumedConversationIds.add(item.resumedFromConversationId)
    }
  }
  return items.filter((item) => {
    if (item.type !== 'conversation') return true
    return !resumedConversationIds.has(item.id)
  })
}

/** Stable React-Native list key for a ProjectChat. */
export function projectChatKey(item: ProjectChat): string {
  return `${item.serverId}::${item.type}:${item.id}`
}

// ── Single-server hook ──────────────────────────────────────────────────

export interface UseProjectChatsResult {
  items: ProjectChat[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refresh: () => Promise<void>
}

/**
 * Single-server unified list. The eager multi-server hook below merges these.
 */
export function useProjectChats(serverId: string, serverLabel?: string): UseProjectChatsResult {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: projectChatKeys.list(serverId),
    queryFn: async ({ signal }) => {
      const resp = await listProjectChats({ serverId, serverLabel, signal })
      return dedupeProjectChats([...resp.items].sort(sortProjectChats))
    },
    enabled: Boolean(serverId),
    staleTime: 15_000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const refresh = useCallback(async () => {
    const resp = await listProjectChats({
      serverId,
      serverLabel,
      refreshConversations: true,
    })
    const items = dedupeProjectChats([...resp.items].sort(sortProjectChats))
    queryClient.setQueryData(projectChatKeys.list(serverId), items)
  }, [serverId, serverLabel, queryClient])

  return {
    items: query.data ?? [],
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refresh,
  }
}

// ── Multi-server hook ───────────────────────────────────────────────────

export interface UseAllProjectChatsResult {
  items: ProjectChat[]
  isLoading: boolean
  isFetching: boolean
  refresh: () => Promise<void>
}

/**
 * Fans out to every active server, merges results, and exposes a single
 * `refresh` that pull-to-refresh callers can wire up.
 */
export function useAllProjectChats(): UseAllProjectChatsResult {
  const activeServerIds = useServersStore((s) => s.activeServerIds)
  const servers = useServersStore((s) => s.servers)
  const queryClient = useQueryClient()

  const queryKey = useMemo(() => ['projectChats-all', ...activeServerIds], [activeServerIds])

  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const merged: ProjectChat[] = []
      for (const id of activeServerIds) {
        if (signal?.aborted) throw new Error('aborted')
        const label = servers[id]?.label
        const resp = await listProjectChats({ serverId: id, serverLabel: label, signal })
        merged.push(...resp.items)
        // Seed the per-server cache so single-server screens hydrate fast.
        queryClient.setQueryData(
          projectChatKeys.list(id),
          dedupeProjectChats([...resp.items].sort(sortProjectChats)),
        )
      }
      return dedupeProjectChats(merged.sort(sortProjectChats))
    },
    enabled: activeServerIds.length > 0,
    staleTime: 15_000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  const refresh = useCallback(async () => {
    const merged: ProjectChat[] = []
    for (const id of activeServerIds) {
      const label = servers[id]?.label
      const resp = await listProjectChats({
        serverId: id,
        serverLabel: label,
        refreshConversations: true,
      })
      merged.push(...resp.items)
      queryClient.setQueryData(
        projectChatKeys.list(id),
        dedupeProjectChats([...resp.items].sort(sortProjectChats)),
      )
    }
    queryClient.setQueryData(queryKey, dedupeProjectChats(merged.sort(sortProjectChats)))
  }, [activeServerIds, servers, queryClient, queryKey])

  return {
    items: query.data ?? [],
    isLoading: query.isPending,
    isFetching: query.isFetching,
    refresh,
  }
}

// ── Invalidations (used by create/resume mutations) ─────────────────────

export function invalidateProjectChats(queryClient: ReturnType<typeof useQueryClient>, serverId?: string) {
  if (serverId) {
    queryClient.invalidateQueries({ queryKey: projectChatKeys.list(serverId) })
  }
  // Also invalidate the multi-server roll-up so it re-fans-out.
  queryClient.invalidateQueries({ queryKey: ['projectChats-all'], exact: false })
}

// ── User-facing badge label ─────────────────────────────────────────────

export function getProjectChatBadge(item: ProjectChat): 'Active' | 'Resumable' | 'Archived' | null {
  if (item.type === 'session') return 'Active'
  if (item.status === 'resumable') return 'Resumable'
  if (item.status === 'archived') return 'Archived'
  return null
}

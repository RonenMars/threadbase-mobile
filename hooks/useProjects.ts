import { useInfiniteQuery } from '@tanstack/react-query'
import { listProjects } from '@/services/projects-api'
import type { Project } from '@/services/projects-api'

const LIMIT = 50

export interface UseProjectsResult {
  projects: (Project & { serverId: string })[]
  isLoading: boolean
  isFetching: boolean
  fetchNextPage: () => void
  hasNextPage: boolean
}

export function useProjects(serverId: string): UseProjectsResult {
  const query = useInfiniteQuery({
    queryKey: ['projects', serverId] as const,
    queryFn: ({ pageParam = 0, signal }) =>
      listProjects(serverId, LIMIT, pageParam as number, signal),
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((n, p) => n + p.projects.length, 0)
      return fetched < lastPage.total ? fetched : undefined
    },
    initialPageParam: 0,
    enabled: !!serverId,
  })

  const projects = (query.data?.pages ?? []).flatMap((p) =>
    p.projects.map((proj) => ({ ...proj, serverId })),
  )

  return {
    projects,
    isLoading: query.isPending,
    isFetching: query.isFetching,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
  }
}

import { createApiForServer } from '@/services/api-client'

/** One project's aggregate, grouped from the server's conversation cache.
 *  `path` is the raw project_path the conversation list matches on, so a
 *  summary row is always joinable against /api/conversations?project=<path>. */
export interface ProjectSummary {
  path: string
  name: string
  conversationCount: number
  lastActivity: string
}

export interface ProjectSummaryPage {
  projects: ProjectSummary[]
  total: number
  offset: number
  hasMore: boolean
}

export async function listProjectSummaries(
  serverId: string,
  limit = 200,
  offset = 0,
  signal?: AbortSignal,
): Promise<ProjectSummaryPage> {
  const api = createApiForServer(serverId)
  return api.get<ProjectSummaryPage>(
    `/api/projects/summary?limit=${limit}&offset=${offset}`,
    { signal },
  )
}

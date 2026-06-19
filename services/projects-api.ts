import { createApiForServer } from '@/services/api-client'

export interface Project {
  name: string
  path: string
  dirName: string
}

export interface ProjectsPage {
  projects: Project[]
  total: number
}

export async function listProjects(
  serverId: string,
  limit = 50,
  offset = 0,
  signal?: AbortSignal,
): Promise<ProjectsPage> {
  const api = createApiForServer(serverId)
  return api.get<ProjectsPage>(`/api/projects?limit=${limit}&offset=${offset}`, { signal })
}

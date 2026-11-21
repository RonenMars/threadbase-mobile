import { describeRoute } from '@/services/route-label'

describe('describeRoute', () => {
  it.each([
    ['GET', '/api/sessions', 'GET /sessions'],
    ['POST', '/api/sessions/start', 'POST /sessions/start'],
    ['GET', '/api/sessions/ab12-34ef?limit=5', 'GET /sessions/:id'],
    ['get', '/api/projects/summary', 'GET /projects/summary'],
    ['GET', '/api', 'GET /'],
  ])('%s %s', (method, path, expected) => {
    expect(describeRoute(method, path)).toBe(expected)
  })
})

// Fixed route labels only; never accept a caller-provided path as a log field.
export const SAFE_API_ROUTES = new Set([
  '/api/info', '/api/config/feature-flags', '/api/config/claude-flags',
  '/api/conversations', '/api/conversations/count', '/api/conversations/:id',
  '/api/sessions', '/api/sessions/count', '/api/sessions/recents',
  '/api/sessions/start', '/api/sessions/resume', '/api/sessions/:id',
  '/api/cache/alert', '/api/cache/alert/resolve',
])

// Match known routes only. Unknown paths never become telemetry attributes.
export function apiRouteTemplate(path: string): string | undefined {
  const route = path.split('?')[0]
  if (SAFE_API_ROUTES.has(route) && !route.includes(':')) return route
  if (/^\/api\/conversations\/[^/]+$/.test(route)) return '/api/conversations/:id'
  if (/^\/api\/sessions\/[^/]+$/.test(route)) return '/api/sessions/:id'
  return undefined
}

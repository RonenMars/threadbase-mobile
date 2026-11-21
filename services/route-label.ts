const ID_SEGMENT = /\d/

/** `POST`, `/api/sessions/ab12-34?x=1` -> `POST /sessions/:id`. Mechanical, so new routes need no entry. */
export function describeRoute(method: string, path: string): string {
  const segments = path
    .split('?')[0]
    .replace(/^\/api(?=\/|$)/, '')
    .split('/')
    .map((segment) => (ID_SEGMENT.test(segment) ? ':id' : segment))
  return `${method.toUpperCase()} ${segments.join('/') || '/'}`
}

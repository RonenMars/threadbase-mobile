/** Non-empty path segments. Null, undefined, or empty → []. */
export function pathSegments(path: string | null | undefined): string[] {
  return path?.split('/').filter(Boolean) ?? []
}

/** Last segment, or undefined when the path is missing. */
export function basename(path: string | null | undefined): string | undefined {
  const parts = pathSegments(path)
  return parts[parts.length - 1]
}

/** Last `count` segments joined (`ai-tools/tb-mobile`). Missing path → ''. */
export function shortPath(path: string | null | undefined, count = 2): string {
  const parts = pathSegments(path)
  if (parts.length === 0) return ''
  return parts.slice(-count).join('/')
}

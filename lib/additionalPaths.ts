/**
 * Extra directories for a new session, beyond the one it starts in.
 *
 * The streamer is authoritative (it resolves every entry under its browse root
 * and drops covered ones — streamer `resolveAdditionalPaths`); these helpers
 * only keep the picker from showing a selection the server would discard.
 * Browse paths are relative to the browse root, with `''` meaning the root.
 */

/** Mirrors the streamer's `MAX_ADDITIONAL_PATHS`. */
export const MAX_ADDITIONAL_PATHS = 8

function isSameOrInside(path: string, parent: string): boolean {
  if (parent === '') return true
  return path === parent || path.startsWith(`${parent}/`)
}

/** Add `path` unless it is already selected or the list is full. */
export function addAdditionalPath(list: readonly string[], path: string): string[] {
  if (list.includes(path) || list.length >= MAX_ADDITIONAL_PATHS) return [...list]
  return [...list, path]
}

export function canAddAdditionalPath(list: readonly string[], path: string): boolean {
  return !list.includes(path) && list.length < MAX_ADDITIONAL_PATHS
}

/**
 * The extras to send for a session starting in `primary`: entries the primary
 * or another kept entry already covers are dropped, in the caller's order.
 */
export function additionalPathsForStart(primary: string, list: readonly string[]): string[] {
  const kept: string[] = []
  const byLength = [...new Set(list)].sort((a, b) => a.length - b.length)
  for (const p of byLength) {
    if (isSameOrInside(p, primary)) continue
    if (kept.some((k) => isSameOrInside(p, k))) continue
    kept.push(p)
  }
  return list.filter((p, i) => kept.includes(p) && list.indexOf(p) === i)
}

/** URL param form for `/session/new?extra=`. Empty list → no param. */
export function encodeAdditionalPathsParam(list: readonly string[]): string | undefined {
  return list.length > 0 ? JSON.stringify(list) : undefined
}

/** Inverse of `encodeAdditionalPathsParam`; anything malformed reads as none. */
export function parseAdditionalPathsParam(raw: string | undefined): string[] {
  if (!raw) return []
  let parsed: string | number | boolean | null | object
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .slice(0, MAX_ADDITIONAL_PATHS)
}

/**
 * A session's extra directories as the server sent them. The field is
 * additive and untyped on the wire, so a non-array or non-string entry reads
 * as absent rather than reaching the UI.
 */
export function sessionAdditionalPaths(value: readonly string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((p): p is string => typeof p === 'string' && p.length > 0)
}

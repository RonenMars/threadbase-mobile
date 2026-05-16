// Server-identity color palette.
//
// Eight brand-safe entries, all passing ≥4.5:1 contrast against --tb-ink-1
// (#070b11). Used by ServerChip and by the ConversationListItem's left
// accent strip to disambiguate rows across multiple active servers.
//
// Brand amber (#f08a24) is reserved for the "live / now" indicator on rows;
// it stays in the palette but is the last to be auto-assigned and carries
// a warning when picked manually (see Settings color picker).

export const SERVER_PALETTE: readonly string[] = [
  '#63b3ff', // Brand blue
  '#4ade80', // Success green
  '#22d3ee', // Cyan
  '#a78bfa', // Violet
  '#fb7185', // Coral
  '#fbbf24', // Warm amber
  '#a3a3a3', // Neutral grey
  '#f08a24', // Brand amber — reserved for live, last to auto-assign
] as const

/** Default fallback when no color has been assigned. */
export const SERVER_COLOR_DEFAULT = SERVER_PALETTE[0]

/**
 * Pick the lowest-index palette color not used by any of the given servers.
 * Wraps to index 0 when all eight are taken (acceptable — repeats are visible
 * but harmless and the manual picker can override).
 */
export function pickNextServerColor(usedColors: readonly (string | undefined)[]): string {
  const used = new Set(usedColors.filter(Boolean))
  for (const c of SERVER_PALETTE) {
    if (!used.has(c)) return c
  }
  return SERVER_PALETTE[0]
}

/** Compose a two-letter initial from a label, e.g. "tb-streamer" → "TB". */
export function initialsFor(label: string | undefined, fallback = '?'): string {
  if (!label) return fallback
  const cleaned = label.trim()
  if (!cleaned) return fallback
  // Split on non-alphanumeric runs, take the first letter of the first two parts.
  const parts = cleaned.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

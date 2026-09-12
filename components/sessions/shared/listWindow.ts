/**
 * Virtualization caps for the session/project lists.
 *
 * Expanding a collapsed server header pushes that host's whole list into
 * `data` at once. At FlatList's default windowSize (21 viewports) that mounts
 * every row in a couple of back-to-back batches — on a host with ~130 projects
 * the hub's glass-backed cards blocked JS for seconds, so the chevron did not
 * flip until long after the tap.
 */
export const LIST_WINDOW = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 5,
  windowSize: 5,
} as const

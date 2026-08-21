/** Status shown on a live surface. Narrower than SessionStatus: terminal sessions end the activity. */
export type LiveActivityStatus = 'running' | 'waiting_input'

/**
 * Content state for one live session surface.
 * Flat primitives only — this crosses a native bridge and will later ride a
 * 4 KB APNs payload. `startedAt` is epoch ms so the OS can tick its own timer
 * instead of us pushing per-second updates.
 */
export interface LiveSessionState {
  sessionId: string
  serverId: string
  projectName: string
  status: LiveActivityStatus
  startedAt: number
  lastOutput: string
  serverLabel?: string
  /**
   * Pre-resolved i18n label for `status` ("Running" / "Finished"). The widget
   * extension's `'widget'`-directive layout function runs in an isolated
   * bundle with no closures over app modules, so `t()` cannot run there —
   * this must be resolved before the state crosses into the activity.
   */
  statusLabel: string
}

/** Max concurrent activities. iOS allows 5; 3 leaves headroom. */
export const MAX_LIVE_ACTIVITIES = 3

/** Terminal-line budget. Dynamic Island compact slots are very narrow. */
export const LAST_OUTPUT_MAX_CHARS = 90

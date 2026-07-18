// A "dead-on-arrival" / terminal session has no live PTY and nothing to wait
// for over WS: it started, exited with zero prompts and zero output, and no
// terminal_output / session_ready event will ever arrive. Waiting on WS for
// these hangs the loader forever, so callers must render an ended state now.
//
// Shape (all required): ptyAttached false, status idle/on_hold, promptCount 0,
// empty lastOutput. Legacy streamers also emit completed/failed as terminal.
// Do NOT key on conversationId — it always equals id and is never blank.
//
// `status` is widened to string so legacy/on_hold values the current
// SessionStatus union no longer names are still matchable at runtime.
export interface TerminalSessionShape {
  ptyAttached: boolean
  status: string
  promptCount: number
  lastOutput: string
}

export function isTerminalSession(session: TerminalSessionShape): boolean {
  const { ptyAttached, status, promptCount, lastOutput } = session

  // Legacy terminal statuses — never wait on WS for these either.
  if (status === 'completed' || status === 'failed') return true

  return (
    ptyAttached === false &&
    (status === 'idle' || status === 'on_hold') &&
    (promptCount ?? 0) === 0 &&
    !lastOutput
  )
}

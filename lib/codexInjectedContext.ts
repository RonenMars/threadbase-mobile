/** Codex records AGENTS / sandbox / streamer argv prompts as role:user — hide from chat. */
export function isCodexInjectedContext(text: string): boolean {
  if (text.startsWith('# AGENTS.md') || text.includes('<INSTRUCTIONS>')) return true
  if (text.startsWith('<permissions instructions>') || text.includes('Filesystem sandboxing defines')) {
    return true
  }
  if (text.includes('limit the options to at most 3')) return true
  if (text.includes('You are working within the project boundary:')) return true
  if (
    text.includes(
      'Do not read, write, or execute commands that access files or directories outside this boundary',
    )
  ) {
    return true
  }
  return false
}

/**
 * Claude Code injects a finished background Task tool's report back into the
 * transcript as a role:user line wrapped in `<task-notification>` — the CLI's
 * own way of telling the agent a subagent came back, never something the
 * human typed. Same treatment as isCodexInjectedContext: hide from chat
 * instead of rendering it as a normal "sent by you" bubble.
 */
export function isTaskNotification(text: string): boolean {
  return text.trimStart().startsWith('<task-notification>')
}

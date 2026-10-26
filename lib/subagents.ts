import type { Conversation } from '@/types/api'

/** A conversation row is read-only when it is a sub-agent transcript. */
export function isSubagentRow(c: Pick<Conversation, 'isSubagent' | 'parentConversationId'>): boolean {
  return c.isSubagent === true || Boolean(c.parentConversationId)
}

/**
 * An older streamer ignores `?parent=` and returns its normal list. Any row
 * that is not a sub-agent of `parentId` means the filter was not applied, so
 * the whole page is untrusted and must not be rendered as children.
 */
export function isSubagentPageSupported(rows: readonly Conversation[], parentId: string): boolean {
  return rows.every((r) => r != null && r.isSubagent === true && r.parentConversationId === parentId)
}

function nonEmpty(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** description ?? name ?? the title the conversation list already derives. */
export function resolveSubagentLabel(c: Conversation): string {
  return nonEmpty(c.subagentDescription) ?? nonEmpty(c.subagentName) ?? c.title
}

export function resolveSubagentType(c: Conversation): string | undefined {
  return nonEmpty(c.subagentType)
}

/**
 * An older streamer ignores `?include=subagents` and returns its normal list,
 * which holds top-level rows. One such row means the flag was not applied.
 */
export function isAllSubagentsPageSupported(rows: readonly Conversation[]): boolean {
  return rows.every((r) => r != null && r.isSubagent === true && Boolean(r.parentConversationId))
}

export interface SubagentGroup {
  parentId: string
  items: Conversation[]
  activeCount: number
}

/** Groups by parent, parents with the most recent activity first. */
export function groupSubagentsByParent(rows: readonly Conversation[]): SubagentGroup[] {
  const byParent = new Map<string, Conversation[]>()
  for (const r of rows) {
    const pid = r.parentConversationId
    if (!pid) continue
    const list = byParent.get(pid)
    if (list) list.push(r)
    else byParent.set(pid, [r])
  }
  const time = (c: Conversation) => Date.parse(c.lastActivity) || 0
  return [...byParent.entries()]
    .map(([parentId, items]) => {
      const sorted = [...items].sort((a, b) => time(b) - time(a))
      return { parentId, items: sorted, activeCount: sorted.filter((c) => c.subagentActive === true).length }
    })
    .sort((a, b) => time(b.items[0]) - time(a.items[0]))
}

import { resolveDisplayTitle } from '@/lib/displayTitle'
import { sessionKey, type NameOrigin } from '@/stores/sessionNames'
import type { MultiConversation, MultiSession } from '@/types/api'

export interface StoredName {
  name?: string
  origin?: NameOrigin
}

/** Reads from the store's maps, so a list that selects them re-renders on rename. */
export function storedNameFor(
  names: Record<string, string>,
  origins: Record<string, NameOrigin>,
  serverId: string,
  sessionId: string,
): StoredName {
  const key = sessionKey(serverId, sessionId)
  return { name: names[key], origin: origins[key] }
}

function basename(path: string | null | undefined): string | undefined {
  return path?.split('/').filter(Boolean).pop()
}

/**
 * Auto slugs saved before the pipeline existed (`does-the-currently-r`) are
 * lossy, so they are dropped and the server's own first line speaks instead.
 * Every other stored name is shown as typed: a manual rename, or a name merged
 * from the server, which carries no origin and may be a rename made elsewhere.
 */
const LEGACY_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

function split(stored: StoredName): { customName?: string } {
  if (!stored.name) return {}
  if (stored.origin !== 'manual' && stored.name.length <= 20 && LEGACY_SLUG.test(stored.name)) return {}
  return { customName: stored.name }
}

export interface RowTitle {
  title: string
  /** The pipeline rejected every message and fell back to project · branch: a noise row. */
  noise: boolean
}

export function resolveSessionRowTitle(
  session: Pick<MultiSession, 'sessionName' | 'projectName' | 'projectPath' | 'branch'>,
  stored: StoredName,
): RowTitle {
  const { customName } = split(stored)
  const { title, source } = resolveDisplayTitle({
    customName,
    firstMessage: session.sessionName,
    projectName: session.projectName || basename(session.projectPath),
    branch: session.branch,
  })
  return { title: title || session.projectName || session.projectPath, noise: source === 'project' }
}

export function resolveConversationRowTitle(
  conv: Pick<MultiConversation, 'title' | 'sessionName' | 'projectPath' | 'branch' | 'firstMessage'>,
  stored: StoredName,
): RowTitle {
  const { customName } = split(stored)
  const { title, source } = resolveDisplayTitle({
    customName,
    firstMessage: conv.sessionName ?? conv.firstMessage?.text,
    projectName: basename(conv.projectPath),
    branch: conv.branch,
  })
  return { title: title || conv.title, noise: source === 'project' }
}

export function sessionRowTitle(
  session: Pick<MultiSession, 'sessionName' | 'projectName' | 'projectPath' | 'branch'>,
  stored: StoredName,
): string {
  return resolveSessionRowTitle(session, stored).title
}

export function conversationRowTitle(
  conv: Pick<MultiConversation, 'title' | 'sessionName' | 'projectPath' | 'branch' | 'firstMessage'>,
  stored: StoredName,
): string {
  return resolveConversationRowTitle(conv, stored).title
}

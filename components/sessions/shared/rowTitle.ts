import { resolveDisplayTitle } from '@/lib/displayTitle'
import type { NameOrigin } from '@/stores/sessionNames'
import type { MultiConversation, MultiSession } from '@/types/api'

export interface StoredName {
  name?: string
  origin?: NameOrigin
}

function basename(path: string | null | undefined): string | undefined {
  return path?.split('/').filter(Boolean).pop()
}

/**
 * A name the user typed always wins. Anything else in the store — an auto slug
 * this app saved before the pipeline existed, or a name merged from the server
 * — is a first message to be cleaned at render, never re-PATCHed.
 */
function split(stored: StoredName): { customName?: string; storedMessage?: string } {
  if (!stored.name) return {}
  return stored.origin === 'manual' ? { customName: stored.name } : { storedMessage: stored.name }
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
  const { customName, storedMessage } = split(stored)
  const { title, source } = resolveDisplayTitle({
    customName,
    firstMessage: storedMessage ?? session.sessionName,
    projectName: session.projectName || basename(session.projectPath),
    branch: session.branch,
  })
  return { title: title || session.projectName || session.projectPath, noise: source === 'project' }
}

export function resolveConversationRowTitle(
  conv: Pick<MultiConversation, 'title' | 'sessionName' | 'projectPath' | 'branch' | 'firstMessage'>,
  stored: StoredName,
): RowTitle {
  const { customName, storedMessage } = split(stored)
  const { title, source } = resolveDisplayTitle({
    customName,
    firstMessage: storedMessage ?? conv.sessionName ?? conv.firstMessage?.text,
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

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

export function sessionRowTitle(
  session: Pick<MultiSession, 'sessionName' | 'projectName' | 'projectPath' | 'branch'>,
  stored: StoredName,
): string {
  const { customName, storedMessage } = split(stored)
  const { title } = resolveDisplayTitle({
    customName,
    firstMessage: storedMessage ?? session.sessionName,
    projectName: session.projectName || basename(session.projectPath),
    branch: session.branch,
  })
  return title || session.projectName || session.projectPath
}

export function conversationRowTitle(
  conv: Pick<MultiConversation, 'title' | 'sessionName' | 'projectPath' | 'branch' | 'firstMessage'>,
  stored: StoredName,
): string {
  const { customName, storedMessage } = split(stored)
  const { title } = resolveDisplayTitle({
    customName,
    firstMessage: storedMessage ?? conv.sessionName ?? conv.firstMessage?.text,
    projectName: basename(conv.projectPath),
    branch: conv.branch,
  })
  return title || conv.title
}
